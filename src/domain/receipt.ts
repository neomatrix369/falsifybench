import { STAGES } from './stages'
import { compareScores } from './scoring'
import type { DataMode, MetricScores, ProvenanceStatus, Scenario, ScenarioEvaluation, StageEvent, Verdict } from './types'

export type Clock = () => Date
export type RunIdFactory = () => string

export const systemClock: Clock = () => new Date()

export const randomRunId: RunIdFactory = () => {
  const bytes = new Uint8Array(4)
  globalThis.crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `RUN-${hex.toUpperCase()}`
}

export interface BenchmarkReceipt {
  receiptVersion: '1.0'
  mode: DataMode
  provenance: ProvenanceStatus
  provenanceLabel: string
  scenario: { id: string; version: string; title: string }
  rubricVersion: string
  runId: string
  startedAt: string
  recordedAt: string
  agents: { baseline: string; guarded: string }
  agentExecution: 'scripted_fixture'
  evidenceIds: string[]
  stageEvents: StageEvent[]
  verdicts: { baseline: Verdict; guarded: Verdict; expectedSafe: Verdict }
  scores: {
    baseline: MetricScores & { total: number }
    guarded: MetricScores & { total: number }
    delta: number
  }
  unsafeApprovalPrevented: boolean
}

export class IncompleteRunError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IncompleteRunError'
  }
}

export interface ReceiptInput {
  scenario: Scenario
  evaluation: ScenarioEvaluation
  runId: string
  startedAt: string
  events: StageEvent[]
  mode: DataMode
  clock: Clock
}

/** Builds a receipt only for a complete, correctly ordered five-stage run. */
export function createReceipt(input: ReceiptInput): BenchmarkReceipt {
  const { scenario, evaluation, runId, startedAt, events, mode, clock } = input
  if (mode !== 'synthetic') throw new IncompleteRunError('Only synthetic runs can produce a receipt in this PoC.')
  if (events.length !== STAGES.length) {
    throw new IncompleteRunError(`Run has ${events.length} of ${STAGES.length} stage events.`)
  }
  events.forEach((event, i) => {
    if (event.stage !== STAGES[i] || event.order !== i + 1) {
      throw new IncompleteRunError(`Stage event ${i + 1} is out of order.`)
    }
  })

  const { baseline, guarded, rubricVersion } = evaluation.scoring
  const comparison = compareScores(baseline, guarded)

  return {
    receiptVersion: '1.0',
    mode,
    provenance: scenario.provenance.status,
    provenanceLabel: scenario.provenance.label,
    scenario: { id: scenario.id, version: scenario.version, title: scenario.title },
    rubricVersion,
    runId,
    startedAt,
    recordedAt: clock().toISOString(),
    agents: { baseline: scenario.baseline.agentLabel, guarded: scenario.guardedAgentLabel },
    agentExecution: 'scripted_fixture',
    evidenceIds: scenario.evidence.map((item) => item.id),
    stageEvents: events.map((event) => ({ ...event })),
    verdicts: {
      baseline: scenario.baseline.verdict,
      guarded: evaluation.guarded.verdict,
      expectedSafe: evaluation.expectedSafeVerdict,
    },
    scores: {
      baseline: { ...baseline, total: comparison.baselineTotal },
      guarded: { ...guarded, total: comparison.guardedTotal },
      delta: comparison.delta,
    },
    unsafeApprovalPrevented:
      scenario.baseline.verdict === 'proceed' &&
      evaluation.expectedSafeVerdict !== 'proceed' &&
      evaluation.guarded.verdict === evaluation.expectedSafeVerdict,
  }
}
