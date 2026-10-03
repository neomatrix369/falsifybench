import { describe, expect, it } from 'vitest'
import { ei001 } from '../data/ei001'
import { mat001 } from '../data/mat001'
import { evaluationProblems, InvalidEvaluationError, unsealRecovery } from './evaluationCheck'
import type { ScenarioEvaluation } from './types'

describe('evaluationProblems', () => {
  it('passes the shipped evaluations', async () => {
    expect(evaluationProblems(mat001, await mat001.evaluation.unseal())).toEqual([])
    expect(evaluationProblems(ei001, await ei001.evaluation.unseal())).toEqual([])
  })

  it('flags an out-of-range metric', async () => {
    const good = await mat001.evaluation.unseal()
    const bad = { ...good, scoring: { ...good.scoring, guarded: { ...good.scoring.guarded, safeAction: 101 } } }
    expect(evaluationProblems(mat001, bad)).toEqual([expect.stringMatching(/^I6 Rubric metrics are integers 0–100: guarded out of range/)])
  })

  it('flags a finding that cites missing evidence and a wrong guarded agent', async () => {
    const good = await mat001.evaluation.unseal()
    const bad = {
      ...good,
      findings: [{ id: 'F-X', statement: 'x', evidenceIds: ['EV-NOPE'] }],
      guarded: { ...good.guarded, agentLabel: 'Someone else' },
    }
    const problems = evaluationProblems(mat001, bad)
    expect(problems.map((p) => p.slice(0, 2))).toEqual(['I4', 'I8'])
  })

  it('reports a malformed shape instead of throwing', () => {
    const problems = evaluationProblems(mat001, {} as ScenarioEvaluation)
    expect(problems.length).toBeGreaterThan(0)
    for (const p of problems) expect(p).toMatch(/^Malformed evaluation: /)
  })

  it('flags a guarded response with no rationale, which the Guarded panel needs', async () => {
    const good = await mat001.evaluation.unseal()
    const { rationale: _omit, ...guarded } = good.guarded
    void _omit
    expect(evaluationProblems(mat001, { ...good, guarded } as ScenarioEvaluation)).toEqual([
      'Malformed evaluation: guarded.rationale is missing or empty',
    ])
  })
})

describe('unsealRecovery', () => {
  it('asks for a reload after a failed import, and for a data fix after failed checks', () => {
    expect(unsealRecovery(new Error('chunk failed'))).toBe('reload')
    expect(unsealRecovery(new InvalidEvaluationError('MAT-001', ['I6']))).toBe('fix-data')
  })
})
