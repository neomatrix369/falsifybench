import { describe, expect, it } from 'vitest'
import { ei001 } from '../data/ei001'
import { mat001 } from '../data/mat001'
import { lab001 } from '../data/lab001'
import { evaluationProblems, InvalidEvaluationError, unsealRecovery } from './evaluationCheck'
import { UnsealTimeoutError } from './unsealTimeout'
import { liveGuardedAgentLabel } from './live'
import type { GradedRun, ScenarioEvaluation } from './types'
import { scriptedRun } from '../test/scriptedRun'

const withGuardedSafeAction = (run: GradedRun, safeAction: number): GradedRun => ({
  ...run,
  scores: { ...run.scores, guarded: { ...run.scores.guarded, safeAction } },
})

const withLiveGuardedLabel = (run: GradedRun, agentLabel: string): GradedRun => ({
  ...run,
  responses: {
    ...run.responses,
    guarded: {
      ...run.responses.guarded,
      agentLabel,
      live: {
        provider: 'anthropic',
        model: 'claude-stub-1',
        requestId: null,
        latencyMs: 1,
        roundTripMs: 1,
        endpoint: '/api/agents/guarded',
        validatedFields: [],
      },
    },
  },
})

describe('evaluationProblems', () => {
  it('passes the shipped evaluations', async () => {
    for (const scenario of [mat001, ei001, lab001]) {
      const evaluation = await scenario.evaluation.unseal()
      expect(evaluationProblems(scenario, evaluation, scriptedRun(scenario, evaluation))).toEqual([])
    }
  })

  it('flags an out-of-range metric', async () => {
    const good = await mat001.evaluation.unseal()
    const bad = withGuardedSafeAction(scriptedRun(mat001, good), 101)
    expect(evaluationProblems(mat001, good, bad)).toEqual([expect.stringMatching(/^I6 Rubric metrics are integers 0–100: guarded out of range/)])
  })

  it('flags a finding that cites missing evidence and a wrong guarded agent', async () => {
    const good = await mat001.evaluation.unseal()
    const bad = { ...good, findings: [{ id: 'F-X', statement: 'x', evidenceIds: ['EV-NOPE'] }] }
    const problems = evaluationProblems(mat001, bad, scriptedRun(mat001, bad, { agentLabel: 'Someone else' }))
    expect(problems.map((p) => p.slice(0, 2))).toEqual(['I4', 'I8'])
  })

  it('accepts live guarded labels derived from the declared fixture identity', async () => {
    for (const [scenario, expectedLabel] of [
      [ei001, 'Evidence guardrail (claude-stub-1)'],
      [lab001, 'Action guard (claude-stub-1)'],
    ] as const) {
      const evaluation = await scenario.evaluation.unseal()
      const run = scriptedRun(scenario, evaluation)
      const label = liveGuardedAgentLabel(scenario.guardedAgentLabel, 'claude-stub-1')
      expect(label).toBe(expectedLabel)
      expect(evaluationProblems(scenario, evaluation, withLiveGuardedLabel(run, label))).toEqual([])
    }
  })

  it('fails I8 when a live guarded response has the wrong fixture identity', async () => {
    const evaluation = await lab001.evaluation.unseal()
    const run = scriptedRun(lab001, evaluation)
    const problems = evaluationProblems(
      lab001,
      evaluation,
      withLiveGuardedLabel(run, 'Evidence guardrail (claude-stub-1)'),
    )
    expect(problems).toEqual([
      'I8 Guarded response matches the declared agent: Evidence guardrail (claude-stub-1)',
    ])
  })

  it('reports a malformed shape instead of throwing', () => {
    const problems = evaluationProblems(mat001, {} as ScenarioEvaluation, {} as GradedRun)
    expect(problems.length).toBeGreaterThan(0)
    for (const p of problems) expect(p).toMatch(/^Malformed evaluation: /)
  })

  it('flags a missing guarded evidence basis, which the Guarded panel lists', async () => {
    const good = await lab001.evaluation.unseal()
    const { guardedBasis: _omit, ...rest } = good
    void _omit
    expect(evaluationProblems(lab001, rest as ScenarioEvaluation, scriptedRun(lab001, good))).toEqual([
      'Malformed evaluation: guardedBasis is missing or empty',
    ])
  })

  it('flags a guarded response with no rationale, which the Guarded panel needs', async () => {
    const good = await mat001.evaluation.unseal()
    const run = scriptedRun(mat001, good)
    const { rationale: _omit, ...guarded } = run.responses.guarded
    void _omit
    const bad = { ...run, responses: { ...run.responses, guarded } } as GradedRun
    expect(evaluationProblems(mat001, good, bad)).toEqual([
      'Malformed evaluation: guarded.rationale is missing or empty',
    ])
  })
})

it('reports a missing field and a failed gate together', async () => {
  const good = await mat001.evaluation.unseal()
  const run = withGuardedSafeAction(scriptedRun(mat001, good), 101)
  const { rationale: _omit, ...guarded } = run.responses.guarded
  void _omit
  const bad = { ...run, responses: { ...run.responses, guarded } } as GradedRun
  expect(evaluationProblems(mat001, good, bad).map((p) => p.split(':')[0])).toEqual([
    'Malformed evaluation',
    'I6 Rubric metrics are integers 0–100',
  ])
})

describe('unsealRecovery', () => {
  it('asks for a reload after a failed import, and for a data fix after failed checks', () => {
    expect(unsealRecovery(new Error('chunk failed'))).toBe('reload')
    expect(unsealRecovery(new InvalidEvaluationError('MAT-001', ['I6']))).toBe('fix-data')
    expect(unsealRecovery(new UnsealTimeoutError('MAT-001', 15_000))).toBe('retry')
  })
})
