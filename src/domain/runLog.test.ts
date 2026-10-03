import { describe, expect, it } from 'vitest'
import { mat001 } from '../data/mat001'
import { mat001Evaluation } from '../data/mat001.evaluation'
import { createReceipt } from './receipt'
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
    expect(buildRunLog({ state: initialWalkthroughState, scenario: mat001, evaluation: null, receipt: null, unseal: null })).toEqual([])
  })

  it('shows a pending entry while the sealed evaluation loads, with no hidden terms', () => {
    const log = buildRunLog({ state: atAudit, scenario: mat001, evaluation: null, receipt: null, unseal: { requestedAt: at(12) } })
    expect(log[log.length - 1]).toMatchObject({ pending: true, label: 'Waiting for sealed evaluation…' })
    expect(JSON.stringify(log)).not.toMatch(/highest-stress|zero ultrasonic/i)
  })

  it('reports load time on first unseal and reuse on later runs', () => {
    const first = buildRunLog({
      state: atAudit,
      scenario: mat001,
      evaluation: mat001Evaluation,
      receipt: null,
      unseal: { requestedAt: at(12), loadedAt: at(13), ms: 42 },
    })
    expect(first[first.length - 1]?.detail).toMatch(/^42 ms · 3 findings/)
    const reused = buildRunLog({
      state: atAudit,
      scenario: mat001,
      evaluation: mat001Evaluation,
      receipt: null,
      unseal: { requestedAt: at(1), loadedAt: at(2), ms: 5 },
    })
    expect(reused[reused.length - 1]?.detail).toMatch(/already unsealed earlier/)
  })

  it('records a failed unseal instead of staying pending', () => {
    const log = buildRunLog({
      state: atAudit,
      scenario: mat001,
      evaluation: null,
      receipt: null,
      unseal: { requestedAt: at(12) },
      error: new Error('chunk failed'),
    })
    expect(log[log.length - 1]).toMatchObject({ label: 'Sealed evaluation failed to load', detail: 'chunk failed' })
    expect(log.some((e) => e.pending)).toBe(false)
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
      runId: 'RUN-1',
      startedAt: at(10),
      events: done.events,
      mode: 'synthetic',
      clock: () => new Date(at(15)),
    })
    const log = buildRunLog({ state: done, scenario: mat001, evaluation: mat001Evaluation, receipt, unseal: { requestedAt: at(12), loadedAt: at(12), ms: 3 } })
    const facts = (label: RegExp) => Object.fromEntries((log.find((e) => label.test(e.label))?.facts ?? []).map((f) => [f.key, f.value]))
    expect(facts(/started/)['Triggered by']).toBe('Run benchmark button')
    expect(facts(/^Audit started/)['Triggered by']).toBe('Auto-play (3 s tick)')
    expect(facts(/^Baseline/).Execution).toMatch(/no model called/)
    expect(facts(/^Sealed evaluation loaded/)['F-2']).toMatch(/cites EV-UT-01, EV-COV-01/)
    expect(facts(/^Guarded/)['Safe action']).toBe('baseline 0 → guarded 100')
    expect(facts(/^Guarded/).Delta).toBe('95 − 15 = +80')
    expect(facts(/^Receipt/)['Check: order']).toMatch(/evidence → baseline → audit → guarded → receipt → pass/)
    expect(facts(/^Receipt/)['Unsafe approval prevented']).toMatch(/→ yes$/)
  })

  it('keeps sealed terms out of every step before the sealed evaluation loads', () => {
    const preAudit: WalkthroughState = { ...atAudit, reached: 1, cursor: 1, events: atAudit.events.slice(0, 2), triggers: ['run', 'manual'] }
    const log = buildRunLog({ state: preAudit, scenario: mat001, evaluation: null, receipt: null, unseal: null })
    expect(log.every((e) => e.facts && e.facts.length > 0)).toBe(true)
    expect(JSON.stringify(log)).not.toMatch(/highest-stress|zero ultrasonic|F-1|expected safe/i)
  })
})
