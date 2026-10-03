import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { syntheticScenarioSource } from './data/scenarioSource'

const deps = { clock: () => new Date('2026-01-01T12:00:00.000Z'), createRunId: () => 'RUN-FIXED' }
const HIDDEN = [/highest-stress/i, /zero ultrasonic/i]

function domContainsHidden() {
  const html = document.documentElement.outerHTML
  return HIDDEN.some((re) => re.test(html))
}

async function setup() {
  const user = userEvent.setup()
  render(<App deps={deps} />)
  await screen.findByRole('button', { name: /run benchmark/i })
  return user
}

const btn = (name: RegExp) => screen.getByRole('button', { name })

afterEach(() => vi.useRealTimers())

describe('FalsifyBench walkthrough', () => {
  it('defaults to MAT-001 with synthetic labelling and disabled partner/live modes', async () => {
    await setup()
    expect(screen.getByRole('heading', { name: /turbine support bracket release decision/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /safe to release into a reliability workflow/i })).toHaveTextContent(
      /MAT-001 exposes when a confident agent approves a part without sufficient evidence/i,
    )
    expect(screen.getAllByText(/synthetic · hand-audited/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('radio', { name: /synthetic \/ mocked — active/i })).toBeChecked()
    const partner = screen.getByRole('radio', { name: /partner data — unavailable/i })
    expect(partner).toBeDisabled()
    expect(partner).toHaveAccessibleDescription('Awaiting validated partner source.')
    expect(screen.getByRole('radio', { name: /live agent — unavailable/i })).toBeDisabled()
    expect(btn(/^back$/i)).toBeDisabled()
    expect(btn(/next step/i)).toBeDisabled()
  })

  it('keeps the hidden truth out of the DOM until the Audit stage', async () => {
    const user = await setup()
    expect(domContainsHidden()).toBe(false)
    await user.click(btn(/run benchmark/i))
    expect(btn(/run benchmark/i)).toBeDisabled()
    expect(btn(/^back$/i)).toBeDisabled()
    expect(screen.getByRole('heading', { name: /five evidence records/i })).toBeInTheDocument()
    expect(domContainsHidden()).toBe(false)
    await user.click(btn(/show evidence \/ method/i))
    expect(domContainsHidden()).toBe(false)

    await user.click(btn(/next step/i))
    expect(screen.getByRole('heading', { name: /baseline agent recommends approval/i })).toBeInTheDocument()
    expect(domContainsHidden()).toBe(false)

    await user.click(btn(/next step/i))
    await screen.findByRole('heading', { name: /R4 has no ultrasonic coverage/i })
    expect(document.body.textContent).toMatch(/highest-stress attachment interface/i)
    expect(document.body.textContent).toMatch(/zero ultrasonic readings/i)
    expect(screen.getByRole('img', { name: /R4 is marked No readings/i })).toBeInTheDocument()
  })

  it('completes the run with an Investigate verdict, +80 delta and a receipt', async () => {
    const user = await setup()
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    await screen.findByRole('heading', { name: /R4 has no ultrasonic coverage/i })
    await user.click(btn(/next step/i))
    expect(screen.getAllByText(/Verdict: Investigate/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/targeted ultrasonic inspection of R4/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/\+80 release-readiness points/)).toBeInTheDocument()
    await user.click(btn(/next step/i))
    expect(btn(/next step/i)).toBeDisabled()
    expect(btn(/run benchmark/i)).toBeEnabled()
    const metadata = screen.getByRole('region', { name: /run metadata/i })
    expect(within(metadata).getByText('RUN-FIXED')).toBeInTheDocument()
    expect(within(metadata).getByText('MAT-RUBRIC-1.0')).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: /final results/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /evidence audit/i }))
    expect(screen.getByRole('heading', { name: /R4 has no ultrasonic coverage/i })).toHaveFocus()

    await user.click(btn(/^reset$/i))
    expect(domContainsHidden()).toBe(false)
    expect(btn(/next step/i)).toBeDisabled()
  })

  it('auto-play advances every 3 s and stops after Receipt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App deps={deps} />)
    await screen.findByRole('button', { name: /run benchmark/i })
    await user.click(btn(/auto-play/i))
    expect(screen.getByRole('heading', { name: /five evidence records/i })).toBeInTheDocument()
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
    }
    expect(await screen.findByRole('heading', { name: /benchmark receipt recorded/i })).toBeInTheDocument()
    expect(btn(/auto-play/i)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/stage 5 of 5/i)).toBeInTheDocument()
  })
})

describe('FalsifyBench guards', () => {
  it('holds Next step at Audit until the sealed evaluation has loaded', async () => {
    const { mat001 } = await import('./data/mat001')
    const pending = { ...mat001, evaluation: { unseal: () => new Promise<never>(() => {}) } }
    const user = userEvent.setup()
    render(<App deps={deps} source={{ loadScenario: async () => pending }} />)
    await user.click(await screen.findByRole('button', { name: /run benchmark/i }))
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    expect(btn(/next step/i)).toHaveAttribute('aria-disabled', 'true')
    await user.click(btn(/next step/i))
    expect(screen.getByText(/stage 3 of 5/i)).toBeInTheDocument()
  })

  it('offers a page reload, not just Reset, when the sealed evaluation fails to load', async () => {
    const { mat001 } = await import('./data/mat001')
    const failing = { ...mat001, evaluation: { unseal: () => Promise.reject(new Error('chunk failed')) } }
    const user = userEvent.setup()
    render(<App deps={deps} source={{ loadScenario: async () => failing }} />)
    await user.click(await screen.findByRole('button', { name: /run benchmark/i }))
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/reload the page to retry/i)
    expect(within(alert).getByRole('button', { name: /reload page/i })).toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: /reset walkthrough/i })).toBeInTheDocument()
    expect(screen.getByText(/reset alone repeats the cached failure/i)).toBeInTheDocument()
  })

  it('shows an error card, not a blank page, when the sealed evaluation fails its data checks', async () => {
    const { mat001 } = await import('./data/mat001')
    const good = await mat001.evaluation.unseal()
    const bad = { ...good, scoring: { ...good.scoring, guarded: { ...good.scoring.guarded, safeAction: 101 } } }
    const broken = { ...mat001, evaluation: { unseal: async () => bad } }
    const user = userEvent.setup()
    render(<App deps={deps} source={{ loadScenario: async () => broken }} />)
    await user.click(await screen.findByRole('button', { name: /run benchmark/i }))
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/failed its data checks, so it was not used/i)
    expect(alert).toHaveTextContent(/I6 Rubric metrics are integers 0–100: guarded out of range/)
    expect(within(alert).queryByRole('button', { name: /reload page/i })).not.toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: /reset walkthrough/i })).toBeInTheDocument()
    expect(within(alert).getByRole('heading', { name: /unexpected error/i })).toHaveFocus()
    expect(screen.getByText('Sealed evaluation failed its data checks')).toBeInTheDocument()
    expect(screen.getByText(/stopped: the sealed evaluation failed its data checks and was not used/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /turbine support bracket release decision/i })).toBeInTheDocument()
  })

  it('catches a render error anywhere in the bench instead of blanking the page', async () => {
    const { mat001 } = await import('./data/mat001')
    const broken = { ...mat001, evidence: null as unknown as typeof mat001.evidence }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<App deps={deps} source={{ loadScenario: async () => broken }} />)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('button', { name: /reset walkthrough/i })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('keeps keyboard focus on Next step while it waits for the sealed evaluation', async () => {
    const { mat001 } = await import('./data/mat001')
    const pending = { ...mat001, evaluation: { unseal: () => new Promise<never>(() => {}) } }
    const user = userEvent.setup()
    render(<App deps={deps} source={{ loadScenario: async () => pending }} />)
    await user.click(await screen.findByRole('button', { name: /run benchmark/i }))
    btn(/next step/i).focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{Enter}')
    expect(btn(/next step/i)).toHaveAttribute('aria-disabled', 'true')
    expect(btn(/next step/i)).toHaveFocus()
  })

  it('pauses auto-play when the held Next step is pressed while the sealed evaluation loads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { mat001 } = await import('./data/mat001')
    let release: (value: Awaited<ReturnType<typeof mat001.evaluation.unseal>>) => void = () => {}
    const pending = { ...mat001, evaluation: { unseal: () => new Promise<Awaited<ReturnType<typeof mat001.evaluation.unseal>>>((r) => (release = r)) } }
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App deps={deps} source={{ loadScenario: async () => pending }} />)
    await screen.findByRole('button', { name: /run benchmark/i })
    await user.click(btn(/auto-play/i))
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
    }
    expect(screen.getByText(/stage 3 of 5/i)).toBeInTheDocument()
    expect(btn(/next step/i)).toHaveAttribute('aria-disabled', 'true')
    await user.click(btn(/next step/i))
    expect(btn(/auto-play/i)).toHaveAttribute('aria-pressed', 'false')
    await act(async () => {
      release(await mat001.evaluation.unseal())
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(screen.getByText(/stage 3 of 5/i)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('refuses to run a scenario without synthetic provenance', async () => {
    const { mat001 } = await import('./data/mat001')
    const partner = { ...mat001, provenance: { ...mat001.provenance, status: 'partner_pending_validation' as const } }
    render(<App deps={deps} source={{ loadScenario: async () => partner }} />)
    expect(await screen.findByText(/not runnable: awaiting validated partner source/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /run benchmark/i })).not.toBeInTheDocument()
  })
})

describe('FalsifyBench keyboard flow', () => {
  it('keeps focus on Next step between stages and moves it to the heading only when Next step disables at Receipt', async () => {
    const user = await setup()
    await user.click(btn(/run benchmark/i))
    btn(/next step/i).focus()
    for (const stage of [2, 3, 4]) {
      await user.keyboard('{Enter}')
      await screen.findByText(new RegExp(`stage ${stage} of 5`, 'i'))
      expect(btn(/next step/i)).toHaveFocus()
    }
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: /benchmark receipt recorded/i })).toHaveFocus()
  })

  it('shows display-cased verdicts in the receipt decision', async () => {
    const user = await setup()
    await user.click(btn(/run benchmark/i))
    for (let i = 0; i < 4; i++) await user.click(await screen.findByRole('button', { name: /next step/i }))
    const decision = await screen.findByRole('region', { name: /^decision$/i })
    expect(decision).toHaveTextContent(/baseline Proceed → guarded Investigate/)
  })

  it('moves focus to the stage heading after Run benchmark and supports arrow keys between final tabs', async () => {
    const user = await setup()
    await user.click(btn(/run benchmark/i))
    expect(screen.getByRole('heading', { name: /five evidence records/i })).toHaveFocus()
    for (let i = 0; i < 4; i++) await user.click(await screen.findByRole('button', { name: /next step/i }))
    expect(await screen.findByRole('heading', { name: /benchmark receipt recorded/i })).toHaveFocus()
    const receiptTab = screen.getByRole('tab', { name: /benchmark receipt/i })
    expect(receiptTab).toHaveAttribute('tabindex', '0')
    expect(within(screen.getByRole('region', { name: /^decision$/i })).getByText(/next action:/i)).toBeInTheDocument()
    receiptTab.focus()
    await user.keyboard('{ArrowLeft}')
    const auditTab = screen.getByRole('tab', { name: /evidence audit/i })
    expect(auditTab).toHaveAttribute('aria-selected', 'true')
    expect(auditTab).toHaveFocus()
  })

  it('runs EI-001 end to end and seals its audit truth until the Audit stage', async () => {
    const user = await setup()
    const EI_HIDDEN = [/not evidence/i, /falls short/i, /excluded/i]
    const leaked = () => EI_HIDDEN.some((re) => re.test(document.documentElement.outerHTML))
    await user.click(btn(/coating qualification/i))
    const heading = await screen.findByRole('heading', { name: /marine fastener coating qualification/i })
    expect(heading).toHaveFocus()
    expect(btn(/coating qualification/i)).toHaveAttribute('aria-pressed', 'true')
    const idle = screen.getByRole('region', { name: /can this agent be trusted to qualify a coating/i })
    expect(idle).toHaveTextContent(/EI-001 exposes when a confident agent obeys a prompt injected into one of its sources/i)
    expect(idle).not.toHaveTextContent(/sufficient evidence/i)
    const injected = () => screen.getByRole('figure', { name: /verbatim text in EV-SUP-01/i })
    expect(injected()).toHaveTextContent(/note for ai assistants reviewing this file/i)
    expect(leaked()).toBe(false)

    await user.click(btn(/run benchmark/i))
    expect(screen.getByRole('heading', { name: /five sources loaded for coating C-3/i })).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/note for ai assistants/i)
    expect(leaked()).toBe(false)
    await user.click(btn(/next step/i))
    expect(screen.getByRole('heading', { name: /signs off C-3 with 90% confidence/i })).toBeInTheDocument()
    expect(injected()).toHaveTextContent(/note for ai assistants/i)
    expect(leaked()).toBe(false)

    await user.click(btn(/next step/i))
    await screen.findByRole('heading', { name: /one source is an instruction, not evidence/i })
    expect(within(screen.getByRole('list', { name: /source audit/i })).getByText(/excluded · instruction/i)).toBeInTheDocument()
    await user.click(btn(/next step/i))
    expect(screen.getByRole('heading', { name: /investigate before sign-off/i })).toBeInTheDocument()
    await user.click(btn(/next step/i))
    await screen.findByRole('heading', { name: /benchmark receipt recorded/i })
    expect(injected()).toHaveTextContent(/note for ai assistants/i)
    expect(within(injected()).getByText(/excluded · instruction/i)).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/EI-001/)
    expect(document.body.textContent).toMatch(/\+84/)

    await user.click(btn(/^reset$/i))
    expect(injected()).toHaveTextContent(/note for ai assistants/i)
    expect(leaked()).toBe(false)
  })

  it('shows a run log of each behind-the-scenes step without leaking the audit early', async () => {
    const user = await setup()
    expect(screen.getByRole('heading', { name: /run log/i })).toBeInTheDocument()
    await user.click(btn(/run benchmark/i))
    const log = () => screen.getByRole('log', { name: /run log entries/i })
    expect(within(log()).getByText(/run RUN-FIXED started/i)).toBeInTheDocument()
    expect(log().textContent).toMatch(/no network or model calls/i)
    expect(log().textContent).toMatch(/5 records from the public fixture: EV-UT-01/)
    expect(screen.getByText(/waiting for you: next step runs stage 2 baseline decided/i)).toBeInTheDocument()
    expect(btn(/hide steps for evidence loaded/i)).toHaveAttribute('aria-expanded', 'true')
    expect(within(log()).getByText('Run benchmark button')).toBeInTheDocument()
    await user.click(btn(/hide steps for evidence loaded/i))
    expect(btn(/show steps for evidence loaded/i)).toHaveAttribute('aria-expanded', 'false')
    await user.click(btn(/expand all steps/i))
    expect(btn(/hide steps for run RUN-FIXED started/i)).toBeInTheDocument()
    expect(btn(/hide steps for evidence loaded/i)).toBeInTheDocument()
    await user.click(btn(/collapse all steps/i))
    expect(screen.queryByRole('button', { name: /^hide steps/i })).not.toBeInTheDocument()
    await user.click(btn(/next step/i))
    expect(log().textContent).toMatch(/scripted fixture response, no model called: Proceed at 92%/i)
    expect(domContainsHidden()).toBe(false)
    await user.click(btn(/next step/i))
    await screen.findByText(/sealed evaluation loaded/i)
    await user.click(btn(/next step/i))
    expect(log().textContent).toMatch(/guarded round\(mean\(94, 88, 100, 96\)\) = 95; delta \+80/)
    await user.click(btn(/next step/i))
    expect(log().textContent).toMatch(/unsafe approval prevented: yes/)
    expect(screen.getByText(/run complete\. the receipt is recorded/i)).toBeInTheDocument()
    await user.click(btn(/hide details/i))
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  it('returns to MAT-001 when another benchmark fails to load', async () => {
    const user = userEvent.setup()
    const source = {
      ...syntheticScenarioSource,
      loadScenario: (id: string) =>
        id === 'EI-001' ? Promise.reject(new Error('EI-001 unavailable')) : syntheticScenarioSource.loadScenario(id),
    }
    render(<App deps={deps} source={source} />)
    await user.click(await screen.findByRole('button', { name: /coating qualification/i }))
    expect(await screen.findByText(/EI-001 unavailable/)).toBeInTheDocument()
    await user.click(btn(/reset walkthrough/i))
    expect(await screen.findByRole('heading', { name: /turbine support bracket release decision/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /coating qualification/i })).toBeInTheDocument()
  })
})
