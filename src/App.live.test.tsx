import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { scriptedAgentRunner } from './data/scriptedAgentRunner'
import { LIVE_HEALTH_RETRY_MS, LiveAgentError, type LiveHealth } from './domain/live'
import { liveAnswer } from './domain/liveFixtures.test-helpers'
import type { AgentResponse, AgentRunner, ScenarioSource } from './domain/types'

const deps = { clock: () => new Date('2026-01-01T12:00:00.000Z'), createRunId: () => 'RUN-LIVE' }
const HIDDEN = [/highest-stress/i, /zero ultrasonic/i]
const leaked = () => HIDDEN.some((re) => re.test(document.documentElement.outerHTML))
const btn = (name: RegExp) => screen.getByRole('button', { name })
const log = () => screen.getByRole('log', { name: /run log entries/i })
const configured: LiveHealth = { configured: true, provider: 'anthropic', model: 'claude-sonnet-4-6' }

function liveGuardAnswer(): AgentResponse {
  const answer = liveAnswer()
  return {
    ...answer,
    agentLabel: 'Evidence guardrail (claude-stub-1)',
    guard: {
      untrustedSourceIds: ['EV-SUP-01'],
      openGaps: ['Not every requirement is directly measured.'],
      overrides: ['Guard rule: EV-SUP-01 contains instructions addressed to the reader, so it is treated as untrusted.'],
    },
    live: {
      ...answer.live!,
      endpoint: '/api/agents/guarded',
      validatedFields: [...answer.live!.validatedFields, 'untrustedSourceIds', 'openGaps'],
    },
  }
}

function liveRunnerReplying(...replies: (AgentResponse | Error)[]) {
  const baseline = vi.fn(async () => {
    const reply = replies.shift()
    if (!reply) throw new Error('no more replies')
    if (reply instanceof Error) throw reply
    return reply
  })
  const guarded = vi.fn(async () => liveGuardAnswer())
  const runner: AgentRunner = {
    execution: 'live',
    run: (agent) => (agent === 'guarded' ? guarded() : baseline()),
  }
  return { runner, baseline, guarded }
}

async function openLive(runner: AgentRunner, initialId = 'MAT-001', source?: ScenarioSource) {
  const user = userEvent.setup()
  render(
    <App
      deps={deps}
      initialId={initialId}
      {...(source ? { source } : {})}
      liveRunner={runner}
      probeLive={async () => configured}
    />,
  )
  await screen.findByRole('button', { name: /run benchmark/i })
  const live = await screen.findByRole('radio', { name: /live agents — active/i })
  expect(live).toBeEnabled()
  return user
}

describe('Live agent selector', () => {
  it('selects configured live agents by default and runs through the live runner', async () => {
    const { runner, baseline } = liveRunnerReplying(liveAnswer())
    const user = await openLive(runner)
    expect(screen.getByRole('radio', { name: /live agents — active/i })).toBeChecked()
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    await waitFor(() => expect(baseline).toHaveBeenCalledTimes(1))
  })

  it.each([
    ['null', null],
    ['not configured', { ...configured, configured: false }],
  ] as const)('keeps scripted agents active when the health probe is %s', async (_label, health) => {
    const probeLive = vi.fn(async () => health)
    render(<App deps={deps} initialId="MAT-001" probeLive={probeLive} />)
    await waitFor(() => expect(probeLive).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('radio', { name: /scripted fixture — active/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /live agents — unavailable/i })).toBeDisabled()
  })

  it('keeps an explicit scripted choice after a later probe reports configured', async () => {
    const user = userEvent.setup()
    const firstProbe = vi.fn(async () => configured)
    const laterProbe = vi.fn(async () => configured)
    const { rerender } = render(<App deps={deps} initialId="MAT-001" probeLive={firstProbe} />)
    expect(await screen.findByRole('radio', { name: /live agents — active/i })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: /scripted fixture/i }))
    expect(screen.getByRole('radio', { name: /scripted fixture — active/i })).toBeChecked()
    rerender(<App deps={deps} initialId="MAT-001" probeLive={laterProbe} />)
    await waitFor(() => expect(laterProbe).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('radio', { name: /scripted fixture — active/i })).toBeChecked())
    expect(screen.getByRole('radio', { name: /live agents — available/i })).toBeEnabled()
  })

  it('pins the scripted runner when a run starts before configured health arrives', async () => {
    let resolveHealth: (health: LiveHealth | null) => void = () => {}
    const probeLive = vi.fn(() => new Promise<LiveHealth | null>((resolve) => (resolveHealth = resolve)))
    const scriptedRun = vi.fn()
    const runner: AgentRunner = {
      execution: 'scripted',
      run: (agent, scenario, options) => {
        scriptedRun(agent)
        return scriptedAgentRunner.run(agent, scenario, options)
      },
    }
    const liveRun = vi.fn(async () => liveAnswer())
    const liveRunner: AgentRunner = { execution: 'live', run: liveRun }
    const user = userEvent.setup()
    render(<App deps={deps} initialId="MAT-001" runner={runner} liveRunner={liveRunner} probeLive={probeLive} />)
    await user.click(await screen.findByRole('button', { name: /run benchmark/i }))
    await waitFor(() => expect(probeLive).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolveHealth(configured)
    })
    expect(screen.getByRole('radio', { name: /scripted fixture — active/i })).toBeChecked()
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    await waitFor(() => expect(scriptedRun).toHaveBeenCalled())
    expect(liveRun).not.toHaveBeenCalled()
  })

  it('clears a pending-run pin on Reset so the next run uses configured Live', async () => {
    let resolveHealth: (health: LiveHealth | null) => void = () => {}
    const probeLive = vi.fn(() => new Promise<LiveHealth | null>((resolve) => (resolveHealth = resolve)))
    const scriptedRun = vi.fn()
    const runner: AgentRunner = {
      execution: 'scripted',
      run: (agent, scenario, options) => {
        scriptedRun(agent)
        return scriptedAgentRunner.run(agent, scenario, options)
      },
    }
    const liveRun = vi.fn(async () => liveAnswer())
    const liveRunner: AgentRunner = { execution: 'live', run: liveRun }
    const user = userEvent.setup()
    render(<App deps={deps} initialId="MAT-001" runner={runner} liveRunner={liveRunner} probeLive={probeLive} />)
    await waitFor(() => expect(probeLive).toHaveBeenCalledTimes(1))
    await user.click(await screen.findByRole('button', { name: /run benchmark/i }))
    await act(async () => {
      resolveHealth(configured)
    })
    expect(screen.getByRole('radio', { name: /scripted fixture — active/i })).toBeChecked()
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    await waitFor(() => expect(scriptedRun).toHaveBeenCalled())
    expect(liveRun).not.toHaveBeenCalled()

    await user.click(btn(/^reset$/i))
    expect(await screen.findByRole('radio', { name: /live agents — active/i })).toBeChecked()
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    await waitFor(() => expect(liveRun).toHaveBeenCalled())
  })

  it('keeps the reached stage when health becomes configured during a pinned run', async () => {
    let resolveHealth: (health: LiveHealth | null) => void = () => {}
    const probeLive = vi.fn(() => new Promise<LiveHealth | null>((resolve) => (resolveHealth = resolve)))
    const user = userEvent.setup()
    render(<App deps={deps} initialId="MAT-001" probeLive={probeLive} />)
    await waitFor(() => expect(probeLive).toHaveBeenCalledTimes(1))
    await user.click(await screen.findByRole('button', { name: /run benchmark/i }))
    await user.click(btn(/next step/i))
    expect(screen.getByText('Stage 2 of 5')).toBeInTheDocument()
    const trace = screen.getByRole('region', { name: /run trace/i })
    expect(within(trace).getByRole('button', { name: /Baseline decided/ })).toHaveAttribute('aria-current', 'step')

    await act(async () => {
      resolveHealth(configured)
    })
    expect(screen.getByText('Stage 2 of 5')).toBeInTheDocument()
    expect(within(trace).getByRole('button', { name: /Baseline decided/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('radio', { name: /scripted fixture — active/i })).toBeChecked()
  })

  it('retries a null health probe until the server responds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const probeLive = vi.fn((): Promise<LiveHealth | null> => Promise.resolve(null))
      probeLive.mockResolvedValueOnce(null).mockResolvedValue(configured)
      render(<App deps={deps} initialId="MAT-001" probeLive={probeLive} />)
      await act(async () => {
        await Promise.resolve()
      })
      await act(() => vi.advanceTimersByTimeAsync(LIVE_HEALTH_RETRY_MS))
      expect(screen.getByRole('radio', { name: /live agents — active/i })).toBeEnabled()
      expect(probeLive).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries an unconfigured health probe until the server is configured', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const probeLive = vi.fn(async () => configured)
      probeLive.mockResolvedValueOnce({ ...configured, configured: false })
      render(<App deps={deps} initialId="MAT-001" probeLive={probeLive} />)
      await act(async () => {
        await Promise.resolve()
      })
      expect(probeLive).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('radio', { name: /scripted fixture — active/i })).toBeChecked()
      await act(() => vi.advanceTimersByTimeAsync(LIVE_HEALTH_RETRY_MS))
      expect(probeLive).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('radio', { name: /live agents — active/i })).toBeChecked()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops probing after the first configured health response', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const probeLive = vi.fn(async () => configured)
      render(<App deps={deps} initialId="MAT-001" probeLive={probeLive} />)
      await act(async () => {
        await Promise.resolve()
      })
      await act(() => vi.advanceTimersByTimeAsync(3 * LIVE_HEALTH_RETRY_MS))
      expect(probeLive).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels a pending health retry on unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const probeLive = vi.fn((): Promise<LiveHealth | null> => Promise.resolve(null))
      const { unmount } = render(<App deps={deps} initialId="MAT-001" probeLive={probeLive} />)
      await act(async () => {
        await Promise.resolve()
      })
      unmount()
      await act(() => vi.advanceTimersByTimeAsync(3 * LIVE_HEALTH_RETRY_MS))
      expect(probeLive).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays unavailable without a local server, and when the server has no key', async () => {
    const { unmount } = render(<App deps={deps} initialId="MAT-001" />)
    expect(await screen.findByRole('radio', { name: /live agents — unavailable/i })).toBeDisabled()
    unmount()
    render(<App deps={deps} initialId="MAT-001" probeLive={async () => ({ ...configured, configured: false, reason: 'No Anthropic API key in the local server environment. Add ANTHROPIC_API_KEY to .env and restart npm run dev.' })} />)
    await waitFor(() => expect(screen.getAllByText(/the local server is running but no Anthropic API key in the local server environment\. Add ANTHROPIC_API_KEY to \.env and restart npm run dev\./i).length).toBeGreaterThan(0))
    expect(screen.getByRole('radio', { name: /live agents — unavailable/i })).toBeDisabled()
  })
})

describe('Live agent run (injected runner)', () => {
  it('shows a failure with Retry, then both live answers, graded by the rule grader, in a v1.1 receipt', async () => {
    const { runner, baseline, guarded } = liveRunnerReplying(
      new LiveAgentError({ kind: 'upstream', message: 'Anthropic returned HTTP 500: stub', httpStatus: 502, upstreamStatus: 500, requestId: 'req_err_1' }),
      liveAnswer(),
    )
    const user = await openLive(runner)
    await user.click(btn(/run benchmark/i))
    expect(within(log()).getByText(/both agents live via the local server \(claude-sonnet-4-6\)/i)).toBeInTheDocument()
    await user.click(btn(/next step/i))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Anthropic returned HTTP 500: stub')
    expect(alert).toHaveTextContent(/a live agent call failed, so no answer was used/i)
    expect(within(log()).getByText('Live agent call failed')).toBeInTheDocument()
    expect(log()).toHaveTextContent(/req_err_1/)
    expect(screen.getByText(/^Stopped: a live agent call failed/)).toBeInTheDocument()
    expect(leaked()).toBe(false)

    await user.click(within(alert).getByRole('button', { name: /retry live call/i }))
    expect(await screen.findByText('Live model run — claude-stub-1 via the local server')).toBeInTheDocument()
    expect(baseline).toHaveBeenCalledTimes(2)
    expect(guarded).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByText(/both agents are live through the local server; the sealed answer key remains hand-written/i).length).toBeGreaterThan(0)
    expect(log()).toHaveTextContent(/Request IDreq_stub_0001/)
    expect(log()).toHaveTextContent(/412 ms at the provider; 431 ms browser round trip/)
    expect(log()).not.toHaveTextContent(/scripted fixture, no model called/)
    expect(leaked()).toBe(false)

    await user.click(btn(/next step/i))
    await waitFor(() => expect(btn(/next step/i)).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(btn(/next step/i))
    await waitFor(() => expect(screen.getAllByText(/graded by rule grader RULE-GRADER-1\.0/i).length).toBeGreaterThan(0))
    expect(screen.getAllByText('Live model run — claude-stub-1 via the local server').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Guard rules applied').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/EV-SUP-01 contains instructions addressed to the reader/).length).toBeGreaterThan(0)
    expect(log()).toHaveTextContent(/Guard rules applied/)
    expect(guarded).toHaveBeenCalledTimes(1)
    expect(log()).toHaveTextContent(/Graded byRule grader RULE-GRADER-1\.0/)
    await user.click(btn(/next step/i))
    expect(await screen.findByText(/live agents \(claude-stub-1; claude-stub-1\)/i)).toBeInTheDocument()
    expect(screen.getByText('Guard report')).toBeInTheDocument()
    expect(screen.getByText(/rule-grader · RULE-GRADER-1\.0/)).toBeInTheDocument()
    expect(baseline).toHaveBeenCalledTimes(2)
  })

  it('holds Next step while the model is asked, and times out after 30 s with Retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const runner: AgentRunner = { execution: 'live', run: (agent, s) => (agent === 'guarded' ? scriptedAgentRunner.run(agent, s) : new Promise(() => {})) }
      const user = await openLive(runner)
      await user.click(btn(/run benchmark/i))
      await user.click(btn(/next step/i))
      expect(await screen.findByText(/waiting for the live baseline model… next step is held until it answers\./i, { selector: 'p' })).toBeInTheDocument()
      expect(btn(/next step/i)).toHaveAttribute('aria-disabled', 'true')
      await vi.advanceTimersByTimeAsync(30_000)
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/did not answer within 30 s/i)
      expect(within(alert).getByRole('button', { name: /retry live call/i })).toBeInTheDocument()
      expect(log()).toHaveTextContent(/Kindtimeout/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('times out a guarded call separately and retry reruns both live agents', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const baselineAnswers = [liveAnswer(), liveAnswer()]
      const retriedBaseline = baselineAnswers[1]
      const baseline = vi.fn(async () => baselineAnswers.shift()!)
      const signals: AbortSignal[] = []
      let guardedAttempts = 0
      const guarded = vi.fn((options?: { baseline?: AgentResponse; signal?: AbortSignal }) => {
        guardedAttempts += 1
        if (options?.signal) signals.push(options.signal)
        return guardedAttempts === 1 ? new Promise<AgentResponse>(() => {}) : Promise.resolve(liveGuardAnswer())
      })
      const runner: AgentRunner = {
        execution: 'live',
        run: (agent, _scenario, options) => (agent === 'guarded' ? guarded(options) : baseline()),
      }
      const user = await openLive(runner)
      await user.click(btn(/run benchmark/i))
      await user.click(btn(/next step/i))
      await waitFor(() => expect(baseline).toHaveBeenCalledTimes(1))
      await user.click(btn(/next step/i))
      await waitFor(() => expect(guarded).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(30_000)
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/live guarded agent.*did not answer within 30 s/i)
      expect(within(alert).getByRole('button', { name: /retry live call/i })).toBeInTheDocument()
      expect(signals[0].aborted).toBe(true)
      expect(log()).toHaveTextContent(/Live guarded agent call failed/)

      await user.click(within(alert).getByRole('button', { name: /retry live call/i }))
      await waitFor(() => expect(baseline).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(guarded).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(guarded.mock.calls[1][0]?.baseline).toBe(retriedBaseline)
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts the guarded call when evaluation unsealing rejects', async () => {
    const { mat001 } = await import('./data/mat001')
    const failing = { ...mat001, evaluation: { unseal: () => Promise.reject(new Error('chunk failed')) } }
    const baseline = vi.fn(async () => liveAnswer())
    let guardedSignal: AbortSignal | undefined
    const guarded = vi.fn((options?: { signal?: AbortSignal }) => {
      guardedSignal = options?.signal
      return new Promise<AgentResponse>(() => {})
    })
    const runner: AgentRunner = {
      execution: 'live',
      run: (agent, _scenario, options) => (agent === 'guarded' ? guarded(options) : baseline()),
    }
    const source: ScenarioSource = { loadScenario: async () => failing }
    const user = await openLive(runner, 'MAT-001', source)
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    await waitFor(() => expect(baseline).toHaveBeenCalledTimes(1))
    await user.click(btn(/next step/i))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('chunk failed')
    expect(guarded).toHaveBeenCalledTimes(1)
    expect(guardedSignal?.aborted).toBe(true)
  })

  it('cancels an abandoned live call when the walkthrough is reset', async () => {
    let signal: AbortSignal | undefined
    const runner: AgentRunner = {
      execution: 'live',
      run: (agent, s, options) => {
        if (agent === 'guarded') return scriptedAgentRunner.run(agent, s)
        signal = options?.signal
        return new Promise(() => {})
      },
    }
    const user = await openLive(runner)
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    await waitFor(() => expect(signal).toBeDefined())
    expect(signal!.aborted).toBe(false)
    await user.click(btn(/^reset$/i))
    expect(signal!.aborted).toBe(true)
  })
})
