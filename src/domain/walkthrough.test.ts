import { describe, expect, it } from 'vitest'
import { mat001 } from '../data/mat001'
import { mat001Evaluation } from '../data/mat001.evaluation'
import { createReceipt, IncompleteRunError } from './receipt'
import { scriptedRun } from '../test/scriptedRun'
import { STAGES } from './stages'
import {
  controlAvailability,
  initialWalkthroughState,
  walkthroughReducer as reduce,
  type WalkthroughAction,
  type WalkthroughState,
} from './walkthrough'

const AT = (n: number) => new Date(Date.UTC(2026, 0, 1, 12, 0, n)).toISOString()
const run = (actions: WalkthroughAction[], from: WalkthroughState = initialWalkthroughState) => actions.reduce(reduce, from)
const start: WalkthroughAction = { type: 'START', runId: 'RUN-TEST', at: AT(0) }
const next = (n: number, source: 'manual' | 'auto' = 'manual'): WalkthroughAction => ({ type: 'NEXT', at: AT(n), source })

describe('walkthrough state machine', () => {
  it('starts idle with only Run available', () => {
    expect(controlAvailability(initialWalkthroughState)).toEqual({
      canRun: true,
      canBack: false,
      canNext: false,
      canAutoplay: true,
      canReset: false,
    })
  })

  it('advances through the five ordered stages and completes at Receipt', () => {
    const s = run([start, next(1), next(2), next(3), next(4)])
    expect(s.status).toBe('complete')
    expect(s.events.map((e) => e.stage)).toEqual(STAGES)
    expect(s.events.map((e) => e.order)).toEqual([1, 2, 3, 4, 5])
    expect(controlAvailability(s)).toMatchObject({ canNext: false, canRun: true })
  })

  it('records what triggered each stage event, outside the events copied into receipts', () => {
    const s = run([start, next(1), next(2, 'auto')])
    expect(s.triggers).toEqual(['run', 'manual', 'autoplay-tick'])
    expect(s.events[0]).not.toHaveProperty('trigger')
    expect(run([{ type: 'AUTOPLAY_ON', runId: 'RUN-A', at: AT(0) }]).triggers).toEqual(['autoplay-start'])
    expect(run([start, next(1), { type: 'BACK' }, next(2)]).triggers).toEqual(['run', 'manual'])
  })

  it('disables Back at Evidence and Run while active', () => {
    const s = run([start])
    expect(STAGES[s.cursor]).toBe('evidence')
    expect(controlAvailability(s)).toMatchObject({ canBack: false, canNext: true, canRun: false })
    expect(reduce(s, start)).toBe(s)
  })

  it('Back revisits without losing outputs; Next replays without new events', () => {
    const s = run([start, next(1), next(2), { type: 'BACK' }, { type: 'BACK' }])
    expect(s.cursor).toBe(0)
    expect(s.reached).toBe(2)
    const replay = run([next(9), next(9)], s)
    expect(replay.cursor).toBe(2)
    expect(replay.events).toHaveLength(3)
    expect(replay.events[2].at).toBe(AT(2))
  })

  it('SELECT focuses only completed stages', () => {
    const s = run([start, next(1), next(2)])
    expect(reduce(s, { type: 'SELECT', index: 0 }).cursor).toBe(0)
    expect(reduce(s, { type: 'SELECT', index: 4 })).toBe(s)
  })

  it('manual navigation pauses auto-play', () => {
    const playing = run([{ type: 'AUTOPLAY_ON', runId: 'RUN-TEST', at: AT(0) }])
    expect(playing.autoplay).toBe(true)
    expect(reduce(playing, next(1)).autoplay).toBe(false)
    expect(reduce(run([next(1, 'auto')], playing), { type: 'BACK' }).autoplay).toBe(false)
    expect(reduce(run([next(1, 'auto')], playing), { type: 'SELECT', index: 0 }).autoplay).toBe(false)
  })

  it('auto-play stops after Receipt', () => {
    const s = run([{ type: 'AUTOPLAY_ON', runId: 'RUN-TEST', at: AT(0) }, next(1, 'auto'), next(2, 'auto'), next(3, 'auto'), next(4, 'auto')])
    expect(s.status).toBe('complete')
    expect(s.autoplay).toBe(false)
  })

  it('auto-play resumes from a selected stage of a completed run without restarting it', () => {
    const done = run([start, next(1), next(2), next(3), next(4)])
    const resumed = run([{ type: 'SELECT', index: 1 }, { type: 'AUTOPLAY_ON', runId: 'RUN-OTHER', at: AT(9) }], done)
    expect(resumed).toMatchObject({ runId: done.runId, status: 'complete', cursor: 1, autoplay: true })
    expect(resumed.events).toEqual(done.events)
  })

  it('Reset returns to the initial state', () => {
    expect(run([start, next(1), { type: 'RESET' }])).toEqual(initialWalkthroughState)
  })

  it('manual and auto-play produce identical events and receipts', () => {
    const manual = run([start, next(1), next(2), next(3), next(4)])
    const auto = run([{ type: 'AUTOPLAY_ON', runId: 'RUN-TEST', at: AT(0) }, next(1, 'auto'), next(2, 'auto'), next(3, 'auto'), next(4, 'auto')])
    expect(auto.events).toEqual(manual.events)
    const clock = () => new Date('2026-01-01T12:00:05.000Z')
    const receipt = (s: WalkthroughState) =>
      createReceipt({ scenario: mat001, evaluation: mat001Evaluation, run: scriptedRun(mat001, mat001Evaluation), runId: s.runId!, startedAt: s.startedAt!, events: s.events, mode: 'synthetic', clock })
    expect(receipt(auto)).toEqual(receipt(manual))
  })
})

describe('createReceipt', () => {
  const complete = run([start, next(1), next(2), next(3), next(4)])
  const clock = () => new Date('2026-01-01T12:00:05.000Z')

  it('records every required field with injected clock and run ID', () => {
    const r = createReceipt({ scenario: mat001, evaluation: mat001Evaluation, run: scriptedRun(mat001, mat001Evaluation), runId: 'RUN-TEST', startedAt: AT(0), events: complete.events, mode: 'synthetic', clock })
    expect(r).toMatchObject({
      mode: 'synthetic',
      provenance: 'synthetic_hand_audited',
      provenanceLabel: 'Synthetic · hand-audited',
      scenario: { id: 'MAT-001', version: '1.0' },
      rubricVersion: 'MAT-RUBRIC-1.0',
      runId: 'RUN-TEST',
      recordedAt: '2026-01-01T12:00:05.000Z',
      agents: { baseline: 'Baseline agent (simulated)', guarded: 'Evidence guardrail (simulated)' },
      evidenceIds: ['EV-UT-01', 'EV-IMG-01', 'EV-ALLOY-01', 'EV-MAINT-01', 'EV-COV-01'],
      verdicts: { baseline: 'proceed', guarded: 'investigate', expectedSafe: 'investigate' },
      scores: { baseline: { total: 15 }, guarded: { total: 95 }, delta: 80 },
      unsafeApprovalPrevented: true,
    })
    expect(r.stageEvents).toHaveLength(5)
  })

  it('refuses to fabricate a receipt for an incomplete run', () => {
    const partial = run([start, next(1)])
    expect(() =>
      createReceipt({ scenario: mat001, evaluation: mat001Evaluation, run: scriptedRun(mat001, mat001Evaluation), runId: 'RUN-TEST', startedAt: AT(0), events: partial.events, mode: 'synthetic', clock }),
    ).toThrow(IncompleteRunError)
  })

  it('does not claim an unsafe approval was prevented when approval was the safe verdict', () => {
    const safeProceed = { ...mat001Evaluation, expectedSafeVerdict: 'proceed' as const }
    const r = createReceipt({ scenario: mat001, evaluation: safeProceed, run: scriptedRun(mat001, safeProceed, { verdict: 'proceed' }), runId: 'RUN-TEST', startedAt: AT(0), events: complete.events, mode: 'synthetic', clock })
    expect(r.unsafeApprovalPrevented).toBe(false)
  })

  it('refuses partner-mode receipts', () => {
    expect(() =>
      createReceipt({ scenario: mat001, evaluation: mat001Evaluation, run: scriptedRun(mat001, mat001Evaluation), runId: 'RUN-TEST', startedAt: AT(0), events: complete.events, mode: 'partner', clock }),
    ).toThrow(IncompleteRunError)
  })
})
