import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Root, { BENCH_TAB_KEY, INTRO_DISMISSED_KEY } from './Root'
import { INDUSTRY_FINDINGS } from './config/landing'
import scoreJson from '../public/score/score.json?raw'

const SCORE = JSON.parse(scoreJson)
const HIDDEN = [/highest-stress/i, /zero ultrasonic/i]

beforeEach(() => {
  window.sessionStorage.clear()
  window.scrollTo = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(SCORE), { status: 200 })))
})

afterEach(() => vi.unstubAllGlobals())

const aboutView = () => document.querySelector<HTMLElement>('[data-view="about"]')
const benchView = () => document.querySelector<HTMLElement>('[data-view="benchmark"]')!

describe('About / Benchmark view switch', () => {
  it('opens on the About page and keeps sealed answer keys out of it', async () => {
    render(<Root />)
    expect(screen.getByRole('heading', { level: 1, name: /confident science agent is not the same/i })).toBeInTheDocument()
    expect(within(aboutView()!).getByRole('button', { name: 'About' })).toHaveAttribute('aria-pressed', 'true')
    expect(benchView()).not.toBeVisible()
    await within(aboutView()!).findByText(/MAT-001 · v1.0/)
    expect(HIDDEN.some((re) => re.test(aboutView()!.innerHTML))).toBe(false)
  })

  it('switches to the benchmark and back from the header and the hero CTA', async () => {
    const user = userEvent.setup()
    render(<Root />)
    await user.click(screen.getAllByRole('button', { name: /open the benchmark/i })[0])
    expect(aboutView()).toBeNull()
    expect(benchView()).toBeVisible()
    expect(await within(benchView()).findByRole('button', { name: /run benchmark/i })).toBeInTheDocument()
    expect(window.sessionStorage.getItem(INTRO_DISMISSED_KEY)).toBe('1')

    await user.click(within(benchView()).getByRole('button', { name: 'About' }))
    expect(aboutView()).toBeVisible()
    expect(benchView()).not.toBeVisible()

    await user.click(within(aboutView()!).getByRole('button', { name: 'Benchmark' }))
    expect(benchView()).toBeVisible()
  })

  it('goes straight to the benchmark once the intro was dismissed this session', () => {
    window.sessionStorage.setItem(INTRO_DISMISSED_KEY, '1')
    render(<Root />)
    expect(aboutView()).toBeNull()
    expect(benchView()).toBeVisible()
  })

  it('opens the benchmark on Simple, remembers Detailed and reopens on it', async () => {
    const user = userEvent.setup()
    const first = render(<Root />)
    await user.click(screen.getAllByRole('button', { name: /open the benchmark/i })[0])
    const bench = within(benchView())
    expect(await bench.findByRole('tab', { name: 'Simple' })).toHaveAttribute('aria-selected', 'true')
    expect(bench.getByRole('list', { name: /benchmark journey/i })).toBeInTheDocument()

    await user.click(bench.getByRole('tab', { name: 'Detailed' }))
    expect(window.sessionStorage.getItem(BENCH_TAB_KEY)).toBe('detailed')
    expect(await bench.findByRole('tab', { name: 'Detailed' })).toHaveAttribute('aria-selected', 'true')
    expect(bench.getByRole('heading', { name: /run log/i })).toBeInTheDocument()
    first.unmount()

    render(<Root />)
    const bench2 = within(benchView())
    expect(await bench2.findByRole('tab', { name: 'Detailed' })).toHaveAttribute('aria-selected', 'true')
    expect(bench2.getByRole('tab', { name: 'Simple' })).toHaveAttribute('aria-selected', 'false')
  })
})

describe('About page content', () => {
  it('cites a source for every industry figure', () => {
    render(<Root />)
    for (const f of INDUSTRY_FINDINGS) {
      const link = screen.getByRole('link', { name: new RegExp(f.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
      expect(link).toHaveAttribute('href', f.href)
    }
  })

  it('reads current results from the published score, not hard-coded copy', async () => {
    render(<Root />)
    const results = screen.getByRole('region', { name: /current results on the synthetic data/i })
    expect(await within(results).findByText(String(SCORE.agents.guarded.score))).toBeInTheDocument()
    expect(within(results).getByText(String(SCORE.agents.baseline.score))).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('score/score.json')
  })

  it('lists the four implemented rubric metrics and both runnable scenarios', async () => {
    render(<Root />)
    const rubric = screen.getByRole('region', { name: /what gets scored/i })
    for (const m of ['Evidence sufficiency', 'Calibration', 'Safe action', 'Next-test quality']) {
      expect(within(rubric).getByText(m)).toBeInTheDocument()
    }
    const about = within(aboutView()!)
    expect(await about.findByText(/turbine support bracket release decision/i)).toBeInTheDocument()
    expect(await about.findByText(/marine fastener coating qualification/i)).toBeInTheDocument()
    expect(about.getByText(/preview · not runnable/i)).toBeInTheDocument()
  })

  it('runs a pausable ticker of the quoted figures plus the published score', async () => {
    const user = userEvent.setup()
    render(<Root />)
    const ticker = screen.getByRole('region', { name: /industry readings ticker/i })
    const visible = within(ticker).getAllByRole('list')[0]
    for (const f of INDUSTRY_FINDINGS) expect(within(visible).getByText(f.ticker)).toBeInTheDocument()
    expect(await within(visible).findByText(String(SCORE.agents.guarded.score))).toBeInTheDocument()
    expect(ticker.querySelectorAll('ul')[1]).toHaveAttribute('aria-hidden', 'true')
    const pause = within(ticker).getByRole('button', { name: /pause ticker/i })
    await user.click(pause)
    expect(within(ticker).getByRole('button', { name: /play ticker/i })).toHaveAttribute('aria-pressed', 'true')
    expect(ticker).toHaveAttribute('data-paused', 'true')
  })

  it('maps science-agent themes to honest coverage, with lab hardware marked partly covered', async () => {
    render(<Root />)
    const table = within(aboutView()!).getByRole('table', { name: /science-agent themes/i })
    const row = (name: RegExp) => within(table).getByRole('rowheader', { name })
    expect(row(/benchmark science agents/i)).toHaveTextContent('Covered')
    expect(row(/epistemological agents/i)).toHaveTextContent('Partly covered')
    expect(row(/lab hardware/i)).toHaveTextContent('Partly covered')
    await within(aboutView()!).findByText(/MAT-001 · v1.0/)
  })

  it('ranks the targeted problems, with what the code covers first and the rest dimmed', () => {
    render(<Root />)
    const about = within(aboutView()!)
    const tested = within(about.getByRole('list', { name: /problems it targets/i })).getAllByRole('listitem')
    const later = within(about.getByRole('list', { name: /not covered yet/i })).getAllByRole('listitem')
    expect(tested[0]).toHaveTextContent(/recognise when they are wrong/i)
    tested.forEach((li) => expect(li.textContent).toMatch(/(Covered|Partly covered)$/))
    expect(later.map((li) => li.textContent).join(' ')).toMatch(/multi-agent.*bio.*traceability/i)
    expect(tested.length + later.length).toBe(16)
  })

  it('credits the Encode Challengescape in the hero', () => {
    render(<Root />)
    const hero = within(aboutView()!).getByRole('region', { name: /confident science agent/i })
    const link = within(hero).getByRole('link', { name: /encode: ai for science challengescape/i })
    expect(link).toHaveAttribute('href', 'https://encode-challengescape.pillar.vc/')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('shows a fallback when the published score cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    render(<Root />)
    expect(await screen.findByText(/published score could not be read/i)).toBeInTheDocument()
  })
})
