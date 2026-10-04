import { STAGES } from './stages'
import { compareScores } from './scoring'
import type { DataMode, GradedRun, GraderId, MetricScores, ProvenanceStatus, Scenario, ScenarioEvaluation, StageEvent, Verdict } from './types'

export type Clock = () => Date
export type RunIdFactory = () => string

export const systemClock: Clock = () => new Date()

export const randomRunId: RunIdFactory = () => {
  const bytes = new Uint8Array(4)
  globalThis.crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `RUN-${hex.toUpperCase()}`
}

interface ReceiptCore {
  mode: DataMode
  provenance: ProvenanceStatus
  provenanceLabel: string
  scenario: { id: string; version: string; title: string }
  rubricVersion: string
  runId: string
  startedAt: string
  recordedAt: string
  agents: { baseline: string; guarded: string }
  evidenceIds: string[]
  stageEvents: StageEvent[]
  verdicts: { baseline: Verdict; guarded: Verdict; expectedSafe: Verdict }
  scores: {
    baseline: MetricScores & { total: number }
    guarded: MetricScores & { total: number }
    delta: number
  }
  unsafeApprovalPrevented: boolean
  guardedNextAction: string
}

/** Scripted answers graded by the fixture grader. Unchanged since v1.0 (pinned by tools/receipt/receipt.golden.test.ts). */
export interface BenchmarkReceiptV1 extends ReceiptCore {
  receiptVersion: '1.0'
  agentExecution: 'scripted_fixture'
}

/** One live model call recorded in a v1.1 receipt. */
export interface ReceiptLiveCall {
  provider: 'anthropic'
  model: string
  requestId: string | null
  latencyMs: number
  validatedFields: string[]
}

/**
 * v1.1 = v1.0 plus two fields, written when a live model answered (local runs only) or a grader other than the fixture
 * grader scored the run. `agentExecution` says which agent was live, `grader` names who scored, and `liveCalls` holds
 * one entry per live answer. Every v1.0 field keeps its meaning; `agents.baseline` is the label of the agent that answered.
 */
export interface BenchmarkReceiptV11 extends ReceiptCore {
  receiptVersion: '1.1'
  agentExecution: 'scripted_fixture' | 'live_baseline'
  grader: { id: GraderId; version: string }
  liveCalls: { baseline?: ReceiptLiveCall }
}

export type BenchmarkReceipt = BenchmarkReceiptV1 | BenchmarkReceiptV11

export class IncompleteRunError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IncompleteRunError'
  }
}

export interface ReceiptInput {
  scenario: Scenario
  evaluation: ScenarioEvaluation
  /** The agents' answers and their grades on this run (AgentRunner + Grader). */
  run: GradedRun
  runId: string
  startedAt: string
  events: StageEvent[]
  mode: DataMode
  clock: Clock
}

/** Builds a receipt only for a complete, correctly ordered five-stage run. */
export function createReceipt(input: ReceiptInput): BenchmarkReceipt {
  const { scenario, evaluation, run, runId, startedAt, events, mode, clock } = input
  if (mode !== 'synthetic') throw new IncompleteRunError('Only synthetic runs can produce a receipt in this PoC.')
  if (events.length !== STAGES.length) {
    throw new IncompleteRunError(`Run has ${events.length} of ${STAGES.length} stage events.`)
  }
  events.forEach((event, i) => {
    if (event.stage !== STAGES[i] || event.order !== i + 1) {
      throw new IncompleteRunError(`Stage event ${i + 1} is out of order.`)
    }
  })

  const { baseline, guarded, rubricVersion } = run.scores
  const answers = run.responses
  const comparison = compareScores(baseline, guarded)

  const v1: BenchmarkReceiptV1 = {
    receiptVersion: '1.0',
    mode,
    provenance: scenario.provenance.status,
    provenanceLabel: scenario.provenance.label,
    scenario: { id: scenario.id, version: scenario.version, title: scenario.title },
    rubricVersion,
    runId,
    startedAt,
    recordedAt: clock().toISOString(),
    agents: { baseline: answers.baseline.agentLabel, guarded: scenario.guardedAgentLabel },
    agentExecution: 'scripted_fixture',
    evidenceIds: scenario.evidence.map((item) => item.id),
    stageEvents: events.map((event) => ({ ...event })),
    verdicts: {
      baseline: answers.baseline.verdict,
      guarded: answers.guarded.verdict,
      expectedSafe: evaluation.expectedSafeVerdict,
    },
    scores: {
      baseline: { ...baseline, total: comparison.baselineTotal },
      guarded: { ...guarded, total: comparison.guardedTotal },
      delta: comparison.delta,
    },
    guardedNextAction: answers.guarded.nextAction,
    unsafeApprovalPrevented:
      answers.baseline.verdict === 'proceed' &&
      evaluation.expectedSafeVerdict !== 'proceed' &&
      answers.guarded.verdict === evaluation.expectedSafeVerdict,
  }
  const live = answers.baseline.live
  if (!live && run.grader.id === 'fixture-grader') return v1
  return {
    ...v1,
    receiptVersion: '1.1',
    agents: { baseline: answers.baseline.agentLabel, guarded: scenario.guardedAgentLabel },
    agentExecution: live ? 'live_baseline' : 'scripted_fixture',
    grader: { id: run.grader.id, version: rubricVersion },
    liveCalls: live
      ? { baseline: { provider: live.provider, model: live.model, requestId: live.requestId, latencyMs: live.latencyMs, validatedFields: [...live.validatedFields] } }
      : {},
  }
}
