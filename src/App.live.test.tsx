import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { scriptedAgentRunner } from './data/scriptedAgentRunner'
import { LiveAgentError, type LiveHealth } from './domain/live'
import { liveAnswer } from './domain/liveFixtures.test-helpers'
import type { AgentResponse, AgentRunner } from './domain/types'

const deps = { clock: () => new Date('2026-01-01T12:00:00.000Z'), createRunId: () => 'RUN-LIVE' }
const HIDDEN = [/highest-stress/i, /zero ultrasonic/i]
const leaked = () => HIDDEN.some((re) => re.test(document.documentElement.outerHTML))
const btn = (name: RegExp) => screen.getByRole('button', { name })
const log = () => screen.getByRole('log', { name: /run log entries/i })
const configured: LiveHealth = { configured: true, provider: 'anthropic', model: 'claude-sonnet-4-6' }

function liveRunnerReplying(...replies: (AgentResponse | Error)[]) {
  const baseline = vi.fn(async () => {
    const reply = replies.shift()
    if (!reply) throw new Error('no more replies')
    if (reply instanceof Error) throw reply
    return reply
  })
  const runner: AgentRunner = {
    execution: 'live',
    run: (agent, scenario) => (agent === 'guarded' ? scriptedAgentRunner.run('guarded', scenario) : baseline()),
  }
  return { runner, baseline }
}

async function openLive(runner: AgentRunner, initialId = 'MAT-001') {
  const user = userEvent.setup()
  render(<App deps={deps} initialId={initialId} liveRunner={runner} probeLive={async () => configured} />)
  await screen.findByRole('button', { name: /run benchmark/i })
  const live = await screen.findByRole('radio', { name: /live baseline — available/i })
  expect(live).toBeEnabled()
  await user.click(live)
  await screen.findByRole('radio', { name: /live baseline — active/i })
  return user
}

describe('Live agent selector', () => {
  it('stays unavailable without a local server, and when the server has no key', async () => {
    const { unmount } = render(<App deps={deps} initialId="MAT-001" />)
    expect(await screen.findByRole('radio', { name: /live agent — unavailable/i })).toBeDisabled()
    unmount()
    render(<App deps={deps} initialId="MAT-001" probeLive={async () => ({ ...configured, configured: false, reason: 'has no ANTHROPIC_API_KEY in .env' })} />)
    await waitFor(() => expect(screen.getAllByText(/the local server is running but has no ANTHROPIC_API_KEY/i).length).toBeGreaterThan(0))
    expect(screen.getByRole('radio', { name: /live agent — unavailable/i })).toBeDisabled()
  })
})

describe('Live baseline run (injected runner)', () => {
  it('shows a failure with Retry, then the live answer, graded by the rule grader, in a v1.1 receipt', async () => {
    const { runner, baseline } = liveRunnerReplying(
      new LiveAgentError({ kind: 'upstream', message: 'Anthropic returned HTTP 500: stub', httpStatus: 502, upstreamStatus: 500, requestId: 'req_err_1' }),
      liveAnswer(),
    )
    const user = await openLive(runner)
    await user.click(btn(/run benchmark/i))
    expect(within(log()).getByText(/live baseline \(claude-sonnet-4-6\) via the local server; guarded scripted/i)).toBeInTheDocument()
    await user.click(btn(/next step/i))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Anthropic returned HTTP 500: stub')
    expect(alert).toHaveTextContent(/the live baseline call failed, so no answer was used/i)
    expect(within(log()).getByText('Live baseline call failed')).toBeInTheDocument()
    expect(log()).toHaveTextContent(/req_err_1/)
    expect(screen.getByText(/^Stopped: the live baseline call failed/)).toBeInTheDocument()
    expect(leaked()).toBe(false)

    await user.click(within(alert).getByRole('button', { name: /retry live call/i }))
    expect(await screen.findByText('Live model run — claude-stub-1 via the local server')).toBeInTheDocument()
    expect(baseline).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByText(/only the baseline is live; the guarded agent stays a scripted fixture until step 4/i).length).toBeGreaterThan(0)
    expect(log()).toHaveTextContent(/Request IDreq_stub_0001/)
    expect(log()).toHaveTextContent(/412 ms at the provider; 431 ms browser round trip/)
    expect(log()).not.toHaveTextContent(/scripted fixture, no model called/)
    expect(leaked()).toBe(false)

    await user.click(btn(/next step/i))
    await waitFor(() => expect(btn(/next step/i)).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(btn(/next step/i))
    await waitFor(() => expect(screen.getAllByText(/graded by rule grader RULE-GRADER-1\.0/i).length).toBeGreaterThan(0))
    expect(log()).toHaveTextContent(/Graded byRule grader RULE-GRADER-1\.0/)
    await user.click(btn(/next step/i))
    expect(await screen.findByText(/live baseline \(claude-stub-1\); guarded scripted fixture/i)).toBeInTheDocument()
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
})
