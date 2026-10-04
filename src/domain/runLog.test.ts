import { describe, expect, it } from 'vitest'
import { mat001 } from '../data/mat001'
import { mat001Evaluation } from '../data/mat001.evaluation'
import { lab001 } from '../data/lab001'
import { lab001Evaluation } from '../data/lab001.evaluation'
import { createReceipt } from './receipt'
import { scriptedRun } from '../test/scriptedRun'
import { buildRunLog } from './runLog'
import { initialWalkthroughState, type WalkthroughState } from './walkthrough'

const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 12, 0, s)).toISOString()
const atAudit: WalkthroughState = {
  status: 'active',
  runId: 'RUN-1',
  startedAt: at(10),
  reached: 2,
  cursor: 2,
  autoplay: false,
  triggers: ['run', 'manual', 'manual'],
  events: [
    { order: 1, stage: 'evidence', at: at(10) },
    { order: 2, stage: 'baseline', at: at(11) },
    { order: 3, stage: 'audit', at: at(12) },
  ],
}

describe('buildRunLog', () => {
  it('is empty before a run starts', () => {
    expect(buildRunLog({ state: initialWalkthroughState, scenario: mat001, evaluation: null, run: null, receipt: null, unseal: null })).toEqual([])
  })

  it('shows a pending entry while the sealed evaluation loads, with no hidden terms', () => {
    const log = buildRunLog({ state: atAudit, scenario: mat001, evaluation: null, run: null, receipt: null, unseal: { requestedAt: at(12) } })
    expect(log[log.length - 1]).toMatchObject({ pending: true, label: 'Waiting for sealed evaluation…' })
    expect(JSON.stringify(log)).not.toMatch(/highest-stress|zero ultrasonic/i)
  })

  it('reports load time on first unseal and reuse on later runs', () => {
    const first = buildRunLog({
      state: atAudit,
      scenario: mat001,
      evaluation: mat001Evaluation,
      run: scriptedRun(mat001, mat001Evaluation),
      receipt: null,
      unseal: { requestedAt: at(12), loadedAt: at(13), ms: 42 },
    })
    expect(first[first.length - 1]?.detail).toMatch(/^42 ms · 3 findings/)
    const reused = buildRunLog({
      state: atAudit,
      scenario: mat001,
      evaluation: mat001Evaluation,
      run: scriptedRun(mat001, mat001Evaluation),
      receipt: null,
      unseal: { requestedAt: at(1), loadedAt: at(2), ms: 5 },
    })
    expect(reused[reused.length - 1]?.detail).toMatch(/already unsealed earlier/)
    const reusedFacts = Object.fromEntries((reused[reused.length - 1]?.facts ?? []).map((f) => [f.key, f.value]))
    expect(reusedFacts.Request).toMatch(/^None\. Reusing the evaluation unsealed at/)
    expect(reusedFacts['F-2']).toMatch(/cites EV-UT-01, EV-COV-01/)
  })

  it('records a failed unseal instead of staying pending', () => {
    const log = buildRunLog({
      state: atAudit,
      scenario: mat001,
      evaluation: null, run: null,
      receipt: null,
      unseal: { requestedAt: at(12) },
      error: new Error('chunk failed'),
    })
    expect(log[log.length - 1]).toMatchObject({ label: 'Sealed evaluation failed to load', detail: 'chunk failed' })
    expect(log[log.length - 1]?.facts?.map((f) => f.key)).toEqual(['Produced by', 'Error', 'Effect', 'Recovery'])
    expect(log.some((e) => e.pending)).toBe(false)
  })

  it('evaluates each unsafe-approval clause against the actual verdicts', () => {
    const done: WalkthroughState = {
      ...atAudit,
      status: 'complete',
      reached: 4,
      cursor: 4,
      triggers: ['run', 'manual', 'manual', 'manual', 'manual'],
      events: [...atAudit.events, { order: 4, stage: 'guarded', at: at(13) }, { order: 5, stage: 'receipt', at: at(14) }],
    }
    const cautious = { ...mat001, baseline: { ...mat001.baseline, verdict: 'investigate' as const } }
    const receipt = createReceipt({ scenario: cautious, evaluation: mat001Evaluation, run: scriptedRun(cautious, mat001Evaluation), runId: 'RUN-1', startedAt: at(10), events: done.events, mode: 'synthetic', clock: () => new Date(at(15)) })
    const log = buildRunLog({ state: done, scenario: cautious, evaluation: mat001Evaluation, run: scriptedRun(cautious, mat001Evaluation), receipt, unseal: { requestedAt: at(12), loadedAt: at(12), ms: 3 } })
    const rule = log[log.length - 1]?.facts?.find((f) => f.key === 'Unsafe approval prevented')?.value
    expect(rule).toMatch(/^baseline is Proceed\? Investigate → no;/)
    expect(rule).toMatch(/all three → no$/)
  })

  it('breaks each entry into steps: triggers, scripted inputs, per-metric scores and receipt checks', () => {
    const done: WalkthroughState = {
      ...atAudit,
      status: 'complete',
      reached: 4,
      cursor: 4,
      triggers: ['run', 'manual', 'autoplay-tick', 'autoplay-tick', 'manual'],
      events: [...atAudit.events, { order: 4, stage: 'guarded', at: at(13) }, { order: 5, stage: 'receipt', at: at(14) }],
    }
    const receipt = createReceipt({
      scenario: mat001,
      evaluation: mat001Evaluation,
      run: scriptedRun(mat001, mat001Evaluation),
      runId: 'RUN-1',
      startedAt: at(10),
      events: done.events,
      mode: 'synthetic',
      clock: () => new Date(at(15)),
    })
    const log = buildRunLog({ state: done, scenario: mat001, evaluation: mat001Evaluation, run: scriptedRun(mat001, mat001Evaluation), receipt, unseal: { requestedAt: at(12), loadedAt: at(12), ms: 3 } })
    const facts = (label: RegExp) => Object.fromEntries((log.find((e) => label.test(e.label))?.facts ?? []).map((f) => [f.key, f.value]))
    expect(facts(/started/)['Triggered by']).toBe('Run benchmark button')
    expect(facts(/^Audit started/)['Triggered by']).toBe('Auto-play (3 s tick)')
    expect(facts(/^Baseline/).Execution).toMatch(/no model called/)
    expect(facts(/^Sealed evaluation loaded/)['F-2']).toMatch(/cites EV-UT-01, EV-COV-01/)
    expect(facts(/^Guarded/)['Safe action']).toBe('baseline 0 → guarded 100')
    expect(facts(/^Guarded/).Delta).toBe('95 − 15 = +80')
    expect(facts(/^Receipt/)['Check: order']).toMatch(/evidence → baseline → audit → guarded → receipt → pass/)
    expect(facts(/^Receipt/)['Unsafe approval prevented']).toBe(
      'baseline is Proceed? Proceed → yes; expected safe is not Proceed? Investigate → yes; guarded matches expected safe? Investigate → yes; all three → yes',
    )
    expect(facts(/^Sealed evaluation loaded/)['Produced by']).toMatch(/evaluation\.unseal\(\) settling.*Auto-play \(3 s tick\)/)
  })

  it('keeps sealed terms out of every step before the sealed evaluation loads', () => {
    const preAudit: WalkthroughState = { ...atAudit, reached: 1, cursor: 1, events: atAudit.events.slice(0, 2), triggers: ['run', 'manual'] }
    const log = buildRunLog({ state: preAudit, scenario: mat001, evaluation: null, run: null, receipt: null, unseal: null })
    expect(log.every((e) => e.facts && e.facts.length > 0)).toBe(true)
    expect(JSON.stringify(log)).not.toMatch(/highest-stress|zero ultrasonic|F-1|expected safe/i)
  })
})

describe('abandonedEntry', () => {
  it('names the run and the stage it reached, only for a run still in progress', async () => {
    const { mat001 } = await import('../data/mat001')
    const { walkthroughReducer, initialWalkthroughState } = await import('./walkthrough')
    const { abandonedEntry, buildRunLog } = await import('./runLog')
    const at = '2026-01-01T12:00:00.000Z'
    let s = walkthroughReducer(initialWalkthroughState, { type: 'START', runId: 'RUN-1', at })
    s = walkthroughReducer(s, { type: 'NEXT', source: 'manual', at })
    s = walkthroughReducer(s, { type: 'NEXT', source: 'manual', at })
    const entry = abandonedEntry(s, mat001, 'Reset', at)
    expect(entry).toMatchObject({ label: 'Run RUN-1 abandoned at stage 3 Evidence audit', detail: 'MAT-001 · Reset · no receipt recorded' })
    expect(abandonedEntry(initialWalkthroughState, mat001, 'Reset', at)).toBeNull()
    const idle = { state: initialWalkthroughState, scenario: mat001, evaluation: null, run: null, receipt: null, unseal: null }
    expect(buildRunLog({ ...idle, abandoned: entry })).toEqual([entry])
    expect(buildRunLog(idle)).toEqual([])
  })

  it('leaves nothing for a completed run', async () => {
    const { mat001 } = await import('../data/mat001')
    const { walkthroughReducer, initialWalkthroughState } = await import('./walkthrough')
    const { abandonedEntry } = await import('./runLog')
    const at = '2026-01-01T12:00:00.000Z'
    let s = walkthroughReducer(initialWalkthroughState, { type: 'START', runId: 'RUN-1', at })
    for (let i = 0; i < 4; i++) s = walkthroughReducer(s, { type: 'NEXT', source: 'manual', at })
    expect(s.status).toBe('complete')
    expect(abandonedEntry(s, mat001, 'Reset', at)).toBeNull()
  })
})

describe('buildRunLog guarded entry transparency', () => {
  const atGuarded: WalkthroughState = {
    ...atAudit,
    reached: 3,
    cursor: 3,
    triggers: ['run', 'manual', 'manual', 'manual'],
    events: [...atAudit.events, { order: 4, stage: 'guarded', at: at(13) }],
  }
  const guardedFacts = (scenario: typeof mat001, evaluation: typeof mat001Evaluation) => {
    const log = buildRunLog({ state: atGuarded, scenario, evaluation, run: scriptedRun(scenario, evaluation), receipt: null, unseal: { requestedAt: at(12), loadedAt: at(12), ms: 3 } })
    return Object.fromEntries((log.find((e) => /^Guarded/.test(e.label))?.facts ?? []).map((f) => [f.key, f.value]))
  }

  it('records the public evidence the guard decided from, and that the answer key only grades', () => {
    const facts = guardedFacts(mat001, mat001Evaluation)
    expect(facts['Decided from']).toBe(
      `public evidence only: ${mat001Evaluation.guardedBasis.join(', ')}. The answer key grades the result; it is not an input to either agent`,
    )
    expect(facts.Turns).toBeUndefined()
  })

  it('records per-turn tags for a multi-turn scenario, marking guard turns', () => {
    const facts = guardedFacts(lab001, lab001Evaluation)
    expect(facts['Decided from']).toMatch(/^public evidence only: EV-TEL-01, EV-PROT-04, EV-LOG-01, EV-DECK-01\./)
    expect(facts.Turns).toBe(
      'baseline productive → productive → wasted → unsafe; guarded productive → productive → rectification (guard) → rectification → productive',
    )
  })
})
