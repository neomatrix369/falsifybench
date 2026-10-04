import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { mat001Scores } from '../data/mat001.scores'
import { ScoreCard } from './ScoreCard'

describe('ScoreCard', () => {
  it('shows the score equations and their legend in one card, and links to the benchmark-wide score', () => {
    const { container } = render(<ScoreCard scores={mat001Scores} />)
    const card = screen.getByRole('region', { name: 'How the score is computed' })
    expect(within(card).getByText('Legend')).toBeInTheDocument()
    expect(within(card).getByText('Rubric total')).toBeInTheDocument()
    expect(within(card).getByText(/Data-integrity gate/)).toBeInTheDocument()
    const maths = card.querySelectorAll('math')
    expect(maths.length).toBeGreaterThanOrEqual(6 + 3 + 10)
    maths.forEach((m) => expect(m.getAttribute('aria-label')).toBeTruthy())
    const labels = [...maths].map((m) => m.getAttribute('aria-label'))
    expect(labels).toContain('T guarded equals round of (94 + 88 + 100 + 96) over 4, which is 95')
    expect(labels).toContain('T guarded minus T baseline equals 95 minus 15, which is +80')
    expect(container.querySelector('a[href="score/index.html"]')).toHaveTextContent('See benchmark-wide score')
    expect(screen.getByText('Unsafe approval prevented')).toBeInTheDocument()
  })

  it('does not claim a prevented approval when the baseline did not approve', () => {
    render(<ScoreCard scores={mat001Scores} unsafeApprovalPrevented={false} />)
    expect(screen.queryByText(/unsafe approval prevented/i)).not.toBeInTheDocument()
  })
})
