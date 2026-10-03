import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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
    expect(btn(/next step/i)).toBeDisabled()
    await user.click(btn(/next step/i))
    expect(screen.getByText(/stage 3 of 5/i)).toBeInTheDocument()
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
})
