import { describe, expect, it } from 'vitest'
import { ei001 } from '../data/ei001'
import { ei001Evaluation } from '../data/ei001.evaluation'
import { ei001Guarded } from '../data/ei001.agents'
import { agentDecisionProblems, toAgentDecision } from './agentResponseCheck'
import { gradeRun } from './agentRun'
import { ruleGrader } from './grader'
import { LiveAgentError, type LiveBaselineCall } from './live'
import { liveAnswer } from './liveFixtures.test-helpers'
import { runRecovery } from './recovery'
import { ruleGraderSeam } from './ruleGraderSeam'
import { buildRunLog } from './runLog'
import { UnsealTimeoutError } from './unsealTimeout'
import { initialWalkthroughState, walkthroughReducer, type WalkthroughState } from './walkthrough'

describe('agentDecisionProblems', () => {
  it('accepts a complete decision', () => {
    expect(agentDecisionProblems(toAgentDecision(liveAnswer()))).toEqual([])
  })

  it('reports every problem at once', () => {
    expect(agentDecisionProblems({ verdict: 'approve', confidenceLabel: '', rationale: ['ok', 3], extra: 1, more: 2 })).toEqual([
      'verdict must be one of proceed, investigate, abstain (got "approve")',
      'confidenceLabel must be a non-empty string of at most 2000 characters',
      'claim must be a non-empty string of at most 2000 characters',
      'nextAction must be a non-empty string of at most 2000 characters',
      'rationale[1] must be a non-empty string of at most 2000 characters',
      'unexpected fields: extra, more',
    ])
    expect(agentDecisionProblems('nope')).toEqual(['decision is not an object'])
  })
})

describe('ruleGraderSeam', () => {
  it('adapts ruleGrader to the Grader seam and names itself', () => {
    expect(ruleGraderSeam.id).toBe('rule-grader')
    expect(ruleGraderSeam.rubricVersion(ei001)).toBe('RULE-GRADER-1.0')
    expect(ruleGraderSeam.grade(ei001, ei001Evaluation, 'guarded', ei001Guarded)).toEqual(ruleGrader.grade(ei001, ei001Evaluation, ei001Guarded))
    const run = gradeRun(ruleGraderSeam, ei001, ei001Evaluation, { baseline: liveAnswer(), guarded: ei001Guarded })
    expect(run.grader).toEqual({ id: 'rule-grader', label: expect.stringMatching(/^Rule grader RULE-GRADER-1\.0/) })
    expect(run.scores.baseline.safeAction).toBe(0)
  })
})

describe('runRecovery', () => {
  it('maps live failures to retry-live and leaves the unseal paths alone', () => {
    expect(runRecovery(new LiveAgentError({ kind: 'timeout', message: 'slow' }))).toBe('retry-live')
    expect(runRecovery(new UnsealTimeoutError('EI-001', 15_000))).toBe('retry')
    expect(runRecovery(new Error('chunk failed'))).toBe('reload')
  })
})

describe('Run log for live agents', () => {
  const at = '2026-01-01T00:00:01.000Z'
  const started = walkthroughReducer(initialWalkthroughState, { type: 'START', runId: 'RUN-0000BEEF', at })
  const atBaseline: WalkthroughState = walkthroughReducer(started, { type: 'NEXT', source: 'manual', at: '2026-01-01T00:00:02.000Z' })
  const base = { requestedAt: '2026-01-01T00:00:02.000Z', runId: 'RUN-0000BEEF', attempt: 1 }
  const log = (call: LiveBaselineCall | null) =>
    buildRunLog({ state: atBaseline, scenario: ei001, evaluation: null, run: null, receipt: null, unseal: null, live: { model: 'claude-sonnet-4-6', call } })
  const facts = (entry: { facts?: { key: string; value: string }[] }) => Object.fromEntries((entry.facts ?? []).map((f) => [f.key, f.value]))

  it('says up front that both agents are live', () => {
    const [start] = log(null)
    expect(start.detail).toContain('both agents live via the local server (claude-sonnet-4-6)')
    expect(start.detail).not.toContain('no external API or model calls')
    expect(facts(start).Agents).toMatch(/Baseline and guarded: live model/)
    expect(facts(start)['Network / model calls']).toContain('/api/agents/guarded')
  })

  it('shows the request and a pending line while the model is asked', () => {
    const entries = log({ status: 'pending', ...base })
    expect(entries.map((e) => e.label).slice(-2)).toEqual(['Live baseline requested', 'Waiting for the live baseline…'])
    expect(facts(entries.at(-2)!)['Next step held']).toBe('Yes, until the model answers')
  })

  it('states what actually happened on success: model, request ID, latency, validated fields', () => {
    const entries = log({ status: 'done', ...base, settledAt: '2026-01-01T00:00:03.000Z', response: liveAnswer() })
    const decided = entries.at(-1)!
    expect(decided.label).toBe('Baseline decided')
    expect(decided.detail).toBe('Live model answer from claude-stub-1 in 412 ms: Proceed at 86% confidence')
    expect(facts(decided)).toMatchObject({
      Model: 'claude-stub-1 (as reported by the provider)',
      'Request ID': 'req_stub_0001',
      Latency: '412 ms at the provider; 431 ms browser round trip',
      Validated: 'verdict, confidenceLabel, claim, rationale, nextAction → pass, checked by the local server and again in the browser',
    })
    expect(JSON.stringify(entries)).not.toMatch(/scripted fixture, no model called|no model called/)
  })

  it('records a failure with its kind, status, request ID and every failed check', () => {
    const error = new LiveAgentError({ kind: 'validation', message: 'bad output', httpStatus: 502, requestId: 'req_9', problems: ['a', 'b'] })
    const failed = log({ status: 'error', ...base, settledAt: '2026-01-01T00:00:03.000Z', error }).at(-1)!
    expect(failed.label).toBe('Live agent call failed')
    expect(facts(failed)).toMatchObject({
      Kind: 'validation (model output failed validation)',
      'HTTP status': '502',
      'Request ID': 'req_9',
      'Failed check 1': 'a',
      'Failed check 2': 'b',
      Recovery: 'Retry reruns both live agents for this run; Reset starts a new run',
    })
  })
})
