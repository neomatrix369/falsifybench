import { describe, expect, it } from 'vitest'
import { mat001 } from '../data/mat001'
import { mat001Evaluation } from '../data/mat001.evaluation'
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
})
