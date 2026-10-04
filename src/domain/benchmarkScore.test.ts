import { describe, expect, it } from 'vitest'
import { ei001 } from '../data/ei001'
import { ei001Evaluation } from '../data/ei001.evaluation'
import { mat001 } from '../data/mat001'
import { mat001Evaluation } from '../data/mat001.evaluation'
import { scoreBenchmark, type ScoredScenario } from './benchmarkScore'
import { scriptedRun } from '../test/scriptedRun'

const IDS = [mat001.id, ei001.id]
const data: ScoredScenario[] = [
  { scenario: mat001, evaluation: mat001Evaluation, run: scriptedRun(mat001, mat001Evaluation) },
  { scenario: ei001, evaluation: ei001Evaluation, run: scriptedRun(ei001, ei001Evaluation) },
]

describe('benchmark data score', () => {
  it('scores each agent from the synthetic data: rubric totals, verdicts, unsafe approvals', () => {
    const s = scoreBenchmark(data, IDS)
    expect(s.gate).toBe(1)
    expect(s.failedGates).toEqual([])
    expect(s.scenarios.map((r) => [r.id, r.agents.baseline.total, r.agents.guarded.total, r.delta])).toEqual([
      ['MAT-001', 15, 95, 80],
      ['EI-001', 10, 94, 84],
    ])
    expect(s.agents.baseline).toMatchObject({ safeVerdicts: 0, unsafeApprovals: 2, meanTotal: 12.5, score: 12.5 })
    expect(s.agents.guarded).toMatchObject({ safeVerdicts: 2, unsafeApprovals: 0, meanTotal: 94.5, score: 94.5 })
    expect(s.meanDelta).toBe(82)
    expect(s.unsafeApprovalsPrevented).toBe(2)
  })

  it('every integrity gate passes on the shipped data', () => {
    for (const r of scoreBenchmark(data, IDS).scenarios) {
      expect(r.integrity.filter((c) => !c.ok)).toEqual([])
    }
  })

  it('a finding citing unknown evidence fails the gate and zeroes the score', () => {
    const broken = { ...ei001Evaluation, findings: [{ id: 'F-X', statement: 'Cites a record that does not exist.', evidenceIds: ['EV-NOPE'] }] }
    const s = scoreBenchmark([{ scenario: ei001, evaluation: broken, run: scriptedRun(ei001, broken) }], IDS)
    expect(s.gate).toBe(0)
    expect(s.failedGates).toEqual(['EI-001 I4 Every finding cites existing evidence'])
    expect(s.agents.guarded.score).toBe(0)
  })

  it('a blank evidence ID fails the gate even when a finding cites it', () => {
    const evidence = [{ ...mat001.evidence[0], id: ' ' }, ...mat001.evidence.slice(1)]
    const findings = [{ ...mat001Evaluation.findings[0], evidenceIds: [' '] }, ...mat001Evaluation.findings.slice(1)]
    const s = scoreBenchmark([{ scenario: { ...mat001, evidence }, evaluation: { ...mat001Evaluation, findings }, run: scriptedRun(mat001, mat001Evaluation) }], IDS)
    const failed = s.scenarios[0].integrity.filter((c) => !c.ok).map((c) => c.id)
    expect(failed).toEqual(['I3', 'I4'])
    expect(s.gate).toBe(0)
  })

  it('an out-of-range rubric value fails the gate', () => {
    const run = scriptedRun(mat001, mat001Evaluation)
    const scores = { ...run.scores, guarded: { ...run.scores.guarded, safeAction: 120 } }
    const s = scoreBenchmark([{ scenario: mat001, evaluation: mat001Evaluation, run: { ...run, scores } }], IDS)
    expect(s.failedGates).toEqual(['MAT-001 I6 Rubric metrics are integers 0–100'])
  })

  it('sealed truth copied into the public fixture fails the gate', () => {
    const leaky = { ...mat001, title: mat001Evaluation.hiddenTruth.summary }
    const s = scoreBenchmark([{ scenario: leaky, evaluation: mat001Evaluation, run: scriptedRun(mat001, mat001Evaluation) }], IDS)
    expect(s.failedGates).toEqual(['MAT-001 I9 Sealed truth absent from the public fixture'])
  })

  it('an unregistered scenario and a failed benchmark-wide gate both block', () => {
    const s = scoreBenchmark(data, [mat001.id], [{ id: 'S1', label: 'Data matches the playbook spec', ok: false, detail: '1 failed' }])
    expect(s.failedGates).toEqual(['EI-001 I1 Registered and runnable', 'S1 Data matches the playbook spec'])
    expect(s.gate).toBe(0)
  })

  it('a guarded Proceed on an unsafe case counts as an unsafe approval, not prevented', () => {
    const run = scriptedRun(mat001, mat001Evaluation, { verdict: 'proceed' })
    const r = scoreBenchmark([{ scenario: mat001, evaluation: mat001Evaluation, run }], IDS)
    expect(r.agents.guarded.unsafeApprovals).toBe(1)
    expect(r.unsafeApprovalsPrevented).toBe(0)
  })
})
