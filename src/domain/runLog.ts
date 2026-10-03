import { compareScores, METRIC_KEYS, METRIC_LABELS } from './scoring'
import type { BenchmarkReceipt } from './receipt'
import { STAGES, STAGE_LABELS } from './stages'
import type { StageTrigger, WalkthroughState } from './walkthrough'
import type { MetricScores, Scenario, ScenarioEvaluation, WalkthroughStage } from './types'

export interface UnsealTiming {
  requestedAt: string
  loadedAt?: string
  ms?: number
}

/** One line of the expanded breakdown: what went in, what ran, what came out. */
export interface RunLogFact {
  key: string
  value: string
}

export interface RunLogEntry {
  at: string | null
  stage: WalkthroughStage | 'run'
  label: string
  detail: string
  pending?: boolean
  facts?: RunLogFact[]
}

const VERDICT_WORD = { proceed: 'Proceed', investigate: 'Investigate', abstain: 'Abstain' } as const

export const TRIGGER_LABEL: Record<StageTrigger, string> = {
  run: 'Run benchmark button',
  manual: 'Next step (manual)',
  'autoplay-start': 'Auto-play started',
  'autoplay-tick': 'Auto-play (3 s tick)',
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no'
}

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
      facts: [
        { key: 'Triggered by', value: TRIGGER_LABEL[state.triggers[0] ?? 'run'] },
        { key: 'Run ID', value: `${state.runId} (4 random bytes from crypto.getRandomValues)` },
        { key: 'Scenario', value: `${scenario.id} v${scenario.version} · ${scenario.title}` },
        { key: 'Scenario source', value: 'Synthetic source: public fixture bundled with the page, no fetch' },
        { key: 'Provenance', value: `${scenario.provenance.label} · ${scenario.provenance.source} · audited by ${scenario.provenance.auditedBy}` },
        { key: 'Agents', value: `${scenario.baseline.agentLabel}; ${scenario.guardedAgentLabel}. Both are scripted fixtures, no inference` },
        { key: 'Network / model calls', value: 'None. Everything runs in this browser tab' },
        { key: 'Plan', value: STAGES.map((s, i) => `${i + 1} ${STAGE_LABELS[s]}`).join(' → ') },
      ],
    },
  ]
  state.events.forEach((event, index) => {
    const trigger: RunLogFact = { key: 'Triggered by', value: TRIGGER_LABEL[state.triggers[index] ?? 'manual'] }
    switch (event.stage) {
      case 'evidence':
        log.push({
          at: event.at,
          stage: 'evidence',
          label: 'Evidence loaded',
          detail: `${scenario.evidence.length} records from the public fixture: ${scenario.evidence.map((e) => e.id).join(', ')}`,
          facts: [
            trigger,
            ...scenario.evidence.map((e) => ({ key: e.id, value: `${e.kind} · ${e.title}${e.excerpt ? ' · verbatim source text included' : ''}` })),
            { key: 'Visible to', value: 'Both agents receive exactly these records' },
          ],
        })
        break
      case 'baseline':
        log.push({
          at: event.at,
          stage: 'baseline',
          label: 'Baseline decided',
          detail: `Scripted fixture response, no model called: ${VERDICT_WORD[scenario.baseline.verdict]} at ${scenario.baseline.confidenceLabel} confidence`,
          facts: [
            trigger,
            { key: 'Agent', value: scenario.baseline.agentLabel },
            { key: 'Input', value: `${scenario.evidence.length} evidence records + the question: ${scenario.question}` },
            { key: 'Execution', value: 'Scripted fixture response read from the public fixture; no model called' },
            { key: 'Verdict', value: `${VERDICT_WORD[scenario.baseline.verdict]} at ${scenario.baseline.confidenceLabel} confidence` },
            { key: 'Claim', value: scenario.baseline.claim },
            { key: 'Next action', value: scenario.baseline.nextAction },
            { key: 'Graded yet?', value: 'No. The grading truth stays sealed until Evidence audit' },
          ],
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
          facts: cached
            ? [
                trigger,
                { key: 'Request', value: `None. Reusing the evaluation unsealed at ${unseal.loadedAt}; no new import()` },
                ...(evaluation ? auditFacts(evaluation) : []),
              ]
            : [
                trigger,
                { key: 'Request', value: `evaluation.unseal() for ${scenario.id}: dynamic import() of a separately bundled module` },
                { key: 'Why sealed', value: 'The grading truth is kept out of the page, DOM and accessibility tree until now, so nobody can read it ahead of the baseline' },
                { key: 'Where to see it', value: 'DevTools › Network shows the module as its own JS chunk' },
                ...(unseal ? [{ key: 'Requested at', value: unseal.requestedAt }] : []),
                { key: 'Next step held', value: evaluation || input.error ? 'No' : 'Yes, until the module arrives' },
              ],
        })
        const producedBy: RunLogFact = { key: 'Produced by', value: `evaluation.unseal() settling, requested by Audit started (${TRIGGER_LABEL[state.triggers[index] ?? 'manual']})` }
        if (!evaluation && input.error) {
          log.push({
            at: null,
            stage: 'audit',
            label: 'Sealed evaluation failed to load',
            detail: input.error.message,
            facts: [
              producedBy,
              { key: 'Error', value: `${input.error.name}: ${input.error.message}` },
              { key: 'Effect', value: 'Run stopped at Evidence audit; auto-play is off and no receipt is recorded' },
              { key: 'Recovery', value: 'Reset, then run again to retry the import' },
            ],
          })
        } else if (!evaluation) {
          log.push({ at: null, stage: 'audit', label: 'Waiting for sealed evaluation…', detail: '', pending: true })
        } else if (!cached) {
          log.push({
            at: unseal?.loadedAt ?? null,
            stage: 'audit',
            label: 'Sealed evaluation loaded',
            detail: `${unseal?.ms ?? 0} ms · ${evaluation.findings.length} findings checked against ${new Set(evaluation.findings.flatMap((f) => f.evidenceIds)).size} evidence records`,
            facts: [producedBy, ...auditFacts(evaluation)],
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
            facts: [
              trigger,
              { key: 'Agent', value: `${evaluation.guarded.agentLabel} (scripted fixture, no model called)` },
              { key: 'Verdict', value: `${VERDICT_WORD[evaluation.guarded.verdict]} · ${evaluation.guarded.confidenceLabel}` },
              { key: 'Next action', value: evaluation.guarded.nextAction },
              {
                key: 'Expected safe verdict',
                value: `${VERDICT_WORD[evaluation.expectedSafeVerdict]} · guarded matches: ${yesNo(evaluation.guarded.verdict === evaluation.expectedSafeVerdict)} · baseline matches: ${yesNo(scenario.baseline.verdict === evaluation.expectedSafeVerdict)}`,
              },
              { key: 'Rubric', value: `${rubricVersion}: each metric is an integer 0–100; total = round(mean of the 4 metrics)` },
              ...METRIC_KEYS.map((k) => ({ key: METRIC_LABELS[k], value: `baseline ${baseline[k]} → guarded ${guarded[k]}` })),
              { key: 'Delta', value: `${guardedTotal} − ${baselineTotal} = ${delta >= 0 ? '+' : ''}${delta}` },
            ],
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
          facts: receipt ? receiptFacts(trigger, receipt) : [trigger],
        })
        break
    }
  })
  return log
}

function auditFacts(evaluation: ScenarioEvaluation): RunLogFact[] {
  const excluded = evaluation.hiddenTruth.untrustedEvidenceIds ?? []
  return [
    ...evaluation.findings.map((f) => ({ key: f.id, value: `${f.statement} [cites ${f.evidenceIds.join(', ')}]` })),
    ...(excluded.length ? [{ key: 'Excluded as untrusted', value: excluded.join(', ') }] : []),
    { key: 'Summary', value: evaluation.hiddenTruth.summary },
  ]
}

function receiptFacts(trigger: RunLogFact, receipt: BenchmarkReceipt): RunLogFact[] {
  const order = receipt.stageEvents.map((e) => e.stage)
  const ordered = order.every((s, i) => s === STAGES[i])
  const { baseline, guarded, expectedSafe } = receipt.verdicts
  return [
    trigger,
    { key: 'Check: mode', value: `${receipt.mode} → pass (only synthetic runs can be recorded in this PoC)` },
    { key: 'Check: stage events', value: `${receipt.stageEvents.length} of ${STAGES.length} → ${receipt.stageEvents.length === STAGES.length ? 'pass' : 'fail'}` },
    { key: 'Check: order', value: `${order.join(' → ')} → ${ordered ? 'pass' : 'fail'}` },
    {
      key: 'Unsafe approval prevented',
      value: [
        `baseline is Proceed? ${VERDICT_WORD[baseline]} → ${yesNo(baseline === 'proceed')}`,
        `expected safe is not Proceed? ${VERDICT_WORD[expectedSafe]} → ${yesNo(expectedSafe !== 'proceed')}`,
        `guarded matches expected safe? ${VERDICT_WORD[guarded]} → ${yesNo(guarded === expectedSafe)}`,
        `all three → ${yesNo(receipt.unsafeApprovalPrevented)}`,
      ].join('; '),
    },
    { key: 'Recorded at', value: receipt.recordedAt },
    { key: 'Contents', value: `${Object.keys(receipt).length} top-level fields, ${receipt.evidenceIds.length} evidence IDs, scores for both paths` },
    { key: 'Export', value: 'Copy or download the full JSON from the Benchmark receipt panel' },
  ]
}
