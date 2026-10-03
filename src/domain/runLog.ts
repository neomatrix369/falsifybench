import { compareScores, METRIC_KEYS } from './scoring'
import type { BenchmarkReceipt } from './receipt'
import type { WalkthroughState } from './walkthrough'
import type { MetricScores, Scenario, ScenarioEvaluation, WalkthroughStage } from './types'

export interface UnsealTiming {
  requestedAt: string
  loadedAt?: string
  ms?: number
}

export interface RunLogEntry {
  at: string | null
  stage: WalkthroughStage | 'run'
  label: string
  detail: string
  pending?: boolean
}

const VERDICT_WORD = { proceed: 'Proceed', investigate: 'Investigate', abstain: 'Abstain' } as const

function meanFormula(scores: MetricScores): string {
  return `round(mean(${METRIC_KEYS.map((k) => scores[k]).join(', ')}))`
}

/**
 * Plain-language trace of what the walkthrough does behind each stage.
 * Before the audit stage it only names steps and timings, so it never reveals the sealed evaluation early.
 */
export function buildRunLog(input: {
  state: WalkthroughState
  scenario: Scenario
  evaluation: ScenarioEvaluation | null
  receipt: BenchmarkReceipt | null
  unseal: UnsealTiming | null
  error?: Error | null
}): RunLogEntry[] {
  const { state, scenario, evaluation, receipt, unseal } = input
  if (!state.runId) return []
  const log: RunLogEntry[] = [
    {
      at: state.startedAt,
      stage: 'run',
      label: `Run ${state.runId} started`,
      detail: `${scenario.id} v${scenario.version} · mode: synthetic · ${scenario.provenance.label} · no network or model calls`,
    },
  ]
  for (const event of state.events) {
    switch (event.stage) {
      case 'evidence':
        log.push({
          at: event.at,
          stage: 'evidence',
          label: 'Evidence loaded',
          detail: `${scenario.evidence.length} records from the public fixture: ${scenario.evidence.map((e) => e.id).join(', ')}`,
        })
        break
      case 'baseline':
        log.push({
          at: event.at,
          stage: 'baseline',
          label: 'Baseline decided',
          detail: `Scripted fixture response, no model called: ${VERDICT_WORD[scenario.baseline.verdict]} at ${scenario.baseline.confidenceLabel} confidence`,
        })
        break
      case 'audit': {
        const cached = unseal?.loadedAt !== undefined && state.startedAt !== null && unseal.loadedAt < state.startedAt
        log.push({
          at: event.at,
          stage: 'audit',
          label: 'Audit started',
          detail: cached
            ? 'Sealed evaluation already unsealed earlier in this session; reusing it'
            : 'Unsealing the sealed evaluation (a separate module fetched only at this stage)',
        })
        if (!evaluation && input.error) {
          log.push({ at: null, stage: 'audit', label: 'Sealed evaluation failed to load', detail: input.error.message })
        } else if (!evaluation) {
          log.push({ at: null, stage: 'audit', label: 'Waiting for sealed evaluation…', detail: '', pending: true })
        } else if (!cached) {
          log.push({
            at: unseal?.loadedAt ?? null,
            stage: 'audit',
            label: 'Sealed evaluation loaded',
            detail: `${unseal?.ms ?? 0} ms · ${evaluation.findings.length} findings checked against ${new Set(evaluation.findings.flatMap((f) => f.evidenceIds)).size} evidence records`,
          })
        }
        break
      }
      case 'guarded':
        if (evaluation) {
          const { baseline, guarded, rubricVersion } = evaluation.scoring
          const { baselineTotal, guardedTotal, delta } = compareScores(baseline, guarded)
          log.push({
            at: event.at,
            stage: 'guarded',
            label: `Guarded verdict: ${VERDICT_WORD[evaluation.guarded.verdict]}`,
            detail: `Scored on ${rubricVersion}: baseline ${meanFormula(baseline)} = ${baselineTotal}; guarded ${meanFormula(guarded)} = ${guardedTotal}; delta ${delta >= 0 ? '+' : ''}${delta}`,
          })
        }
        break
      case 'receipt':
        log.push({
          at: event.at,
          stage: 'receipt',
          label: 'Receipt recorded',
          detail: receipt
            ? `Receipt v${receipt.receiptVersion} · ${receipt.stageEvents.length} ordered stage events · unsafe approval prevented: ${receipt.unsafeApprovalPrevented ? 'yes' : 'no'}`
            : 'Assembling receipt…',
        })
        break
    }
  }
  return log
}
