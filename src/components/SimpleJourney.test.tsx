import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { mat001Scores } from '../data/mat001.scores'
import { compareScores, formatDelta } from '../domain/scoring'

const deps = { clock: () => new Date('2026-01-01T12:00:00.000Z'), createRunId: () => 'RUN-FIXED' }
const HIDDEN = [/highest-stress/i, /zero ultrasonic/i]

function domContainsHidden() {
  const html = document.documentElement.outerHTML
  return HIDDEN.some((re) => re.test(html))
}

async function setup() {
  const user = userEvent.setup()
  render(<App deps={deps} initialId="MAT-001" initialTab="simple" />)
  await screen.findByRole('button', { name: /run benchmark/i })
  return user
}

const btn = (name: RegExp) => screen.getByRole('button', { name })
const journey = () => screen.getByRole('list', { name: /benchmark journey/i })
// The 5 step columns only; stage bodies can nest their own lists (e.g. Evidence IDs).
const journeySteps = () => journey().querySelectorAll(':scope > li')
const expected = compareScores(mat001Scores.baseline, mat001Scores.guarded)

describe('Simple tab', () => {
  it('selects Simple in the Benchmark view tablist and lists the 5 journey steps', async () => {
    await setup()
    expect(screen.getByRole('tab', { name: 'Simple' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Detailed' })).toHaveAttribute('aria-selected', 'false')
    expect(journeySteps()).toHaveLength(5)
  })

  it('keeps the sealed truth out until Audit, then shows findings and the unsafe baseline flag', async () => {
    const user = await setup()
    expect(domContainsHidden()).toBe(false)
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    expect(domContainsHidden()).toBe(false)
    expect(screen.queryByText(/failed · unsafe/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/issues found/i)).not.toBeInTheDocument()

    await user.click(btn(/next step/i))
    const findings = await screen.findByRole('list', { name: /issues found/i })
    expect(within(findings).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(screen.getByText(/failed · unsafe/i)).toBeInTheDocument()
  })

  it('re-seals after Reset: a fresh run shows nothing unsealed at baseline', async () => {
    const user = await setup()
    await user.click(btn(/run benchmark/i))
    for (let i = 0; i < 4; i++) await user.click(btn(/next step/i))
    await screen.findByRole('list', { name: /issues found/i })
    await user.click(btn(/^reset$/i))
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    expect(domContainsHidden()).toBe(false)
    expect(screen.queryByText(/failed · unsafe/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/baseline score/i)).not.toBeInTheDocument()
  })

  it('shows the fixture-derived totals, delta, prevented approval and 4-metric breakdown at completion', async () => {
    const user = await setup()
    await user.click(btn(/run benchmark/i))
    for (let i = 0; i < 4; i++) await user.click(btn(/next step/i))
    await screen.findByRole('list', { name: /issues found/i })
    const receipt = journeySteps()[4]
    expect(receipt).toHaveTextContent(String(expected.baselineTotal))
    expect(receipt).toHaveTextContent(String(expected.guardedTotal))
    expect(receipt).toHaveTextContent(`${formatDelta(expected.delta)} points`)
    expect(screen.getByText(/unsafe approval prevented/i)).toBeInTheDocument()
    const table = screen.getByRole('table', { name: /how the score breaks down/i })
    expect(within(table).getAllByRole('rowheader')).toHaveLength(4)
  })

  it('keeps the run when switching to Detailed and back', async () => {
    const user = await setup()
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    await screen.findByRole('list', { name: /issues found/i })
    await user.click(screen.getByRole('tab', { name: 'Detailed' }))
    expect(await screen.findByText(/stage 3 · evidence audit/i)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Simple' }))
    expect(screen.getByRole('list', { name: /issues found/i })).toBeInTheDocument()
    expect(screen.getByText(/failed · unsafe/i)).toBeInTheDocument()
  })

  it('opens the Falsification check stage in Detailed with the result heading focused', async () => {
    const user = await setup()
    await user.click(btn(/run benchmark/i))
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    await screen.findByRole('list', { name: /issues found/i })
    await user.click(within(journeySteps()[2] as HTMLElement).getByRole('button', { name: /details/i }))
    expect(screen.getByRole('tab', { name: 'Detailed' })).toHaveAttribute('aria-selected', 'true')
    const heading = await screen.findByRole('heading', { name: /R4 has no ultrasonic coverage/i })
    expect(heading).toHaveFocus()
  })

  it('switches the benchmark from the Simple picker and stays on Simple', async () => {
    const user = await setup()
    await user.click(btn(/unsafe robot move from a stale message/i))
    await screen.findByRole('heading', { name: /can this lab robot agent be trusted/i })
    expect(screen.getByRole('tab', { name: 'Simple' })).toHaveAttribute('aria-selected', 'true')
    expect(journeySteps()).toHaveLength(5)
    expect(document.body.textContent).toMatch(/LAB-001/)
  })

  it('shows the error card in Simple when the sealed evaluation fails to load', async () => {
    const { mat001 } = await import('../data/mat001')
    const failing = { ...mat001, evaluation: { unseal: () => Promise.reject(new Error('chunk failed')) } }
    const user = userEvent.setup()
    render(<App deps={deps} source={{ loadScenario: async () => failing }} initialTab="simple" />)
    await user.click(await screen.findByRole('button', { name: /run benchmark/i }))
    await user.click(btn(/next step/i))
    await user.click(btn(/next step/i))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/reload the page to retry/i)
    expect(within(alert).getByRole('button', { name: /reset walkthrough/i })).toBeInTheDocument()
  })
})
