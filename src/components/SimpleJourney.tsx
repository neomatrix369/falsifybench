import { ArrowUpRight, ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, LoaderCircle, OctagonAlert, Pause, Play, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { RUNNABLE_BENCHMARKS } from '../data/scenarioSource'
import { SYNTHETIC_LABEL } from '../domain/provenance'
import type { BenchmarkReceipt } from '../domain/receipt'
import { METRIC_KEYS, METRIC_LABELS, compareScores, formatDelta } from '../domain/scoring'
import { unsafeApprovalPrevented } from '../domain/receipt'
import { AUDIT_STAGE_INDEX, LAST_STAGE_INDEX, STAGES } from '../domain/stages'
import { VERDICT_LABEL } from '../domain/verdict'
import { stageVisualState, type WalkthroughState } from '../domain/walkthrough'
import type { GradedRun, Scenario, ScenarioEvaluation, WalkthroughStage } from '../domain/types'
import type { WalkthroughControls } from '../hooks/useWalkthrough'
import { VerdictBadge } from './VerdictBadge'
import type { LiveBaselineView } from './ResultSurface'

const GUARDED_STAGE_INDEX = STAGES.indexOf('guarded')

/** Plain-words name and one-line purpose of each stage, read left to right. */
const STEPS: Record<WalkthroughStage, { title: string; does: string }> = {
  evidence: { title: 'Evidence', does: 'The agent is handed a fixed pack of sources.' },
  baseline: { title: 'Baseline agent', does: 'An agent answers on its own.' },
  audit: { title: 'Falsification check', does: 'FalsifyBench tries to break that answer.' },
  guarded: { title: 'Guarded agent', does: 'The agent answers again with the guard on.' },
  receipt: { title: 'Score', does: 'Both answers are graded and recorded.' },
}

type Tone = 'pending' | 'current' | 'done' | 'issue' | 'failure'

const TONE: Record<Tone, { rule: string; icon: string; status: string; Icon: typeof Circle }> = {
  pending: { rule: 'border-rule', icon: 'text-rule-strong', status: 'text-ink-3', Icon: Circle },
  current: { rule: 'border-primary', icon: 'text-primary', status: 'text-primary', Icon: CircleDot },
  done: { rule: 'border-ok-line', icon: 'text-ok', status: 'text-ok', Icon: CircleCheck },
  issue: { rule: 'border-warn-line', icon: 'text-warn', status: 'font-medium text-warn', Icon: TriangleAlert },
  failure: { rule: 'border-risk-line', icon: 'text-risk', status: 'font-medium text-risk', Icon: OctagonAlert },
}

interface Facts {
  scenario: Scenario
  evaluation: ScenarioEvaluation | null
  run: GradedRun | null
  receipt: BenchmarkReceipt | null
  /** Set when the Agent selector is on Live and the baseline is a model call. */
  live: LiveBaselineView | null
  state: WalkthroughState
}

// Unsafe only when the baseline approved and approval was unsafe, matching domain/receipt.ts.
function baselineUnsafe({ evaluation, run }: Facts) {
  return evaluation && run ? run.responses.baseline.verdict === 'proceed' && evaluation.expectedSafeVerdict !== 'proceed' : false
}

function baselineWrong({ evaluation, run }: Facts) {
  return evaluation && run ? run.responses.baseline.verdict !== evaluation.expectedSafeVerdict : false
}

function toneFor(facts: Facts, index: number): { tone: Tone; status: string } {
  const visual = stageVisualState(facts.state, index)
  const stage = STAGES[index]
  if (visual === 'pending') return { tone: 'pending', status: 'Not yet' }
  if (stage === 'baseline' && baselineUnsafe(facts)) return { tone: 'failure', status: 'Failed · unsafe' }
  if (stage === 'baseline' && baselineWrong(facts)) return { tone: 'issue', status: 'Failed' }
  if (stage === 'audit' && facts.evaluation) return { tone: 'issue', status: `${facts.evaluation.findings.length} issues found` }
  if (stage === 'receipt' && facts.state.status === 'complete') return { tone: 'done', status: 'Recorded' }
  if (visual === 'warning') return { tone: 'issue', status: 'Flagged by check' }
  if (visual === 'active') return { tone: 'current', status: 'Now' }
  return { tone: 'done', status: 'Done' }
}

function Waiting({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-1.5 text-body text-ink-3">
      <LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin" /> {children}
    </p>
  )
}

function ScoreLine({ label, total, tone }: { label: string; total: number; tone: 'risk' | 'ok' }) {
  return (
    <p className="flex items-baseline justify-between border-t border-rule pt-2 text-body text-ink-2">
      {label}
      <span className={`font-mono text-title font-semibold ${tone === 'risk' ? 'text-risk' : 'text-ok'}`}>
        {total}
        <span className="text-meta font-normal text-ink-3">/100</span>
      </span>
    </p>
  )
}

function StepBody({ stage, facts }: { stage: WalkthroughStage; facts: Facts }) {
  const { scenario, evaluation, run, receipt, state } = facts
  const reached = state.reached >= STAGES.indexOf(stage)
  if (!reached) return null
  const graded = state.reached >= GUARDED_STAGE_INDEX && run
  switch (stage) {
    case 'evidence':
      return (
        <>
          <p className="text-body text-ink">
            <span className="font-mono font-semibold">{scenario.evidence.length}</span> sources
          </p>
          <ul aria-label="Evidence IDs" className="flex flex-wrap gap-1">
            {scenario.evidence.map((e) => (
              <li key={e.id} className="whitespace-nowrap rounded-sm border border-rule px-1 font-mono text-meta text-ink-3">
                {e.id}
              </li>
            ))}
          </ul>
        </>
      )
    case 'baseline': {
      // Before Audit the live baseline is the in-flight call, not the scripted fixture; after Audit the graded run wins.
      const answer = run?.responses.baseline ?? (facts.live ? (facts.live.call?.status === 'done' ? facts.live.call.response : null) : scenario.baseline)
      if (!answer) return <Waiting>Waiting for the live baseline model…</Waiting>
      const unsafe = baselineUnsafe(facts)
      return (
        <>
          <VerdictBadge verdict={answer.verdict} unsafe={unsafe} />
          <p className="text-meta text-ink-2">
            Confidence {answer.confidenceLabel}
            {facts.live && <span className="block text-ink-3">Live: {answer.live?.model ?? facts.live.model}</span>}
          </p>
          <p className="line-clamp-3 text-body text-ink-2">{answer.claim}</p>
          {graded && <ScoreLine label="Baseline score" total={compareScores(run.scores.baseline, run.scores.guarded).baselineTotal} tone="risk" />}
        </>
      )
    }
    case 'audit': {
      if (!evaluation) return <Waiting>Unsealing the check…</Waiting>
      const excluded = evaluation.hiddenTruth.untrustedEvidenceIds ?? []
      return (
        <>
          <p className="text-body font-medium text-ink">{evaluation.narrative.auditHeadline}</p>
          <ul aria-label="Issues found" className="space-y-1.5">
            {evaluation.findings.map((f) => (
              <li key={f.id} className="flex gap-1.5 text-meta text-ink-2">
                <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                <span>{f.statement}</span>
              </li>
            ))}
          </ul>
          {excluded.length > 0 && (
            <p className="rounded-sm border border-risk-line bg-risk-tint/60 px-2 py-1 text-meta text-risk">
              Excluded <span className="font-mono">{excluded.join(', ')}</span> · {evaluation.hiddenTruth.untrustedReason ?? 'instruction'}
            </p>
          )}
        </>
      )
    }
    case 'guarded': {
      if (!evaluation || !run) return <Waiting>Preparing the guarded answer…</Waiting>
      const answer = run.responses.guarded
      const safe = answer.verdict === evaluation.expectedSafeVerdict
      return (
        <>
          <VerdictBadge verdict={answer.verdict} />
          <p className={`inline-flex items-center gap-1 text-meta font-medium ${safe ? 'text-ok' : 'text-risk'}`}>
            {safe ? <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> : <OctagonAlert aria-hidden className="h-3.5 w-3.5" />}
            {safe ? 'Matches the safe verdict' : `Unsafe: safe verdict is ${VERDICT_LABEL[evaluation.expectedSafeVerdict]}`}
          </p>
          <p className="line-clamp-3 text-body text-ink-2">{answer.nextAction}</p>
          <ScoreLine label="Guarded score" total={compareScores(run.scores.baseline, run.scores.guarded).guardedTotal} tone={safe ? 'ok' : 'risk'} />
        </>
      )
    }
    case 'receipt': {
      if (!receipt) return <Waiting>Recording the receipt…</Waiting>
      const { baseline, guarded, delta } = receipt.scores
      return (
        <>
          <p className="flex items-baseline gap-2 font-mono">
            <span className="text-title text-risk">{baseline.total}</span>
            <span className="text-ink-3">→</span>
            <span className="text-reading font-semibold text-ink">{guarded.total}</span>
          </p>
          <p className={`font-mono text-lead font-semibold ${delta >= 0 ? 'text-ok' : 'text-risk'}`}>{formatDelta(delta)} points</p>
          {facts.evaluation && facts.run && unsafeApprovalPrevented(facts.run.responses, facts.evaluation) && (
            <p className="inline-flex items-center gap-1 text-meta font-semibold text-ok">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> Unsafe approval prevented
            </p>
          )}
        </>
      )
    }
  }
}

function MetricBreakdown({ run }: { run: GradedRun }) {
  return (
    <table className="w-full text-body">
      <caption className="pb-1 text-left text-body font-semibold text-ink">How the score breaks down</caption>
      <thead>
        <tr className="border-y border-rule text-left text-meta text-ink-3">
          <th scope="col" className="py-1 font-medium">Metric</th>
          <th scope="col" className="py-1 text-right font-medium">Baseline</th>
          <th scope="col" className="py-1 text-right font-medium">Guarded</th>
        </tr>
      </thead>
      <tbody>
        {METRIC_KEYS.map((key) => {
          const b = run.scores.baseline[key]
          const g = run.scores.guarded[key]
          return (
            <tr key={key} className="border-b border-rule">
              <th scope="row" className="py-1 text-left font-normal text-ink-2">{METRIC_LABELS[key]}</th>
              <td className={`py-1 text-right font-mono ${b < 50 ? 'font-semibold text-risk' : 'text-ink'}`}>
                {b}
                {b < 50 && <span className="sr-only"> (failing)</span>}
              </td>
              <td className={`py-1 text-right font-mono ${g < 50 ? 'font-semibold text-risk' : 'text-ink'}`}>
                {g}
                {g < 50 && <span className="sr-only"> (failing)</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

interface Props extends Facts {
  controls: WalkthroughControls
  onSelectBenchmark: (id: string) => void
  onRun: () => void
  onBack: () => void
  onNext: () => void
  onToggleAutoplay: () => void
  onReset: () => void
  onSelect: (index: number) => void
  /** Open a stage in the Detailed tab. */
  onOpenDetail: (index: number) => void
}

export const SimpleJourney = forwardRef<HTMLHeadingElement, Props>(function SimpleJourney(props, headingRef) {
  const { scenario, state, controls, receipt, onSelectBenchmark, onRun, onBack, onNext, onToggleAutoplay, onReset, onSelect, onOpenDetail } = props
  // The hook keeps the graded run across Reset; show nothing sealed until this run reaches Audit.
  const unsealed = state.reached >= AUDIT_STAGE_INDEX
  const facts: Facts = { ...props, evaluation: unsealed ? props.evaluation : null, run: unsealed ? props.run : null }
  const idle = state.status === 'idle'
  return (
    <div className="space-y-4">
      <section aria-label="Choose a benchmark" className="sheet flex flex-wrap items-stretch divide-x divide-rule">
        {RUNNABLE_BENCHMARKS.map((b) => {
          const active = b.id === scenario.id
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={active}
              onClick={() => !active && onSelectBenchmark(b.id)}
              className={`min-w-[12rem] flex-1 px-4 py-2 text-left transition-colors duration-fast first:rounded-l-md last:rounded-r-md ${
                active ? 'bg-primary-tint' : 'hover:bg-sunken'
              }`}
            >
              <span className="block font-mono text-meta text-ink-3">{b.id}</span>
              <span className={`block text-body ${active ? 'font-semibold text-ink' : 'font-medium text-ink-2'}`}>{b.title}</span>
            </button>
          )
        })}
      </section>

      <section aria-labelledby="simple-heading" className="sheet">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule px-6 pb-4 pt-5">
          <div className="min-w-0 max-w-[70ch]">
            <p className="ref">
              {scenario.id} · {scenario.title}
            </p>
            <h2 id="simple-heading" ref={headingRef} tabIndex={-1} className="wide mt-1 text-display font-semibold text-ink focus:outline-none">
              {scenario.narrative.idleQuestion}
            </h2>
            <p className="mt-1 text-body text-ink-2">{scenario.narrative.idleClaim}</p>
          </div>
          <div role="group" aria-label="Walkthrough controls" className="flex flex-wrap items-center gap-2">
            {(idle || state.status === 'complete') && (
              <button type="button" className="btn-primary" onClick={onRun} disabled={!controls.canRun}>
                <Play aria-hidden className="h-4 w-4" />
                {idle ? 'Run benchmark' : 'Run again'}
              </button>
            )}
            {!idle && (
              <>
                <button type="button" className="btn-secondary" onClick={onBack} disabled={!controls.canBack}>
                  <ChevronLeft aria-hidden className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onNext}
                  disabled={!controls.canNext && !controls.nextPending}
                  aria-disabled={controls.nextPending || undefined}
                >
                  Next step
                  <ChevronRight aria-hidden className="h-4 w-4" />
                </button>
              </>
            )}
            <button type="button" className="btn-secondary" onClick={onToggleAutoplay} disabled={!controls.canAutoplay} aria-pressed={state.autoplay}>
              {state.autoplay ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
              {state.autoplay ? 'Pause' : 'Auto-play'}
            </button>
            <button type="button" className="btn-secondary" onClick={onReset} disabled={!controls.canReset}>
              <RotateCcw aria-hidden className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        <ol aria-label="Benchmark journey" className="grid grid-cols-1 md:grid-cols-5">
          {STAGES.map((stage, index) => {
            const { tone, status } = toneFor(facts, index)
            const t = TONE[tone]
            const reached = index <= state.reached
            const current = !idle && index === state.cursor
            return (
              <li
                key={stage}
                aria-current={current ? 'step' : undefined}
                className={`relative flex min-w-0 flex-col gap-2 border-rule px-4 pb-4 pt-3 max-md:border-b md:border-l md:first:border-l-0 ${
                  current ? 'bg-primary-tint/50' : ''
                }`}
              >
                {index > 0 && (
                  <ChevronRight
                    aria-hidden
                    className="absolute -left-2.5 top-3.5 hidden h-5 w-5 rounded-full bg-surface text-ink-3 ring-1 ring-rule md:block"
                  />
                )}
                <div className={`border-t-2 pt-2 ${t.rule}`}>
                  <button
                    type="button"
                    disabled={!reached}
                    onClick={() => onSelect(index)}
                    className="flex w-full items-center gap-1.5 text-left disabled:cursor-default"
                  >
                    <t.Icon aria-hidden className={`h-4 w-4 shrink-0 ${t.icon}`} />
                    <span className="font-mono text-meta text-ink-3">{index + 1}</span>
                    <span className="text-body font-semibold text-ink">{STEPS[stage].title}</span>
                  </button>
                  <p className={`mt-0.5 text-meta ${t.status}`}>{status}</p>
                </div>
                <p className="text-meta text-ink-3">{STEPS[stage].does}</p>
                <StepBody stage={stage} facts={facts} />
                {reached && (index !== AUDIT_STAGE_INDEX || facts.evaluation) && (
                  <button
                    type="button"
                    onClick={() => onOpenDetail(index)}
                    className="mt-auto inline-flex items-center gap-1 self-start pt-1 text-meta font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Details<span className="sr-only">: {STEPS[stage].title}</span>
                    <ArrowUpRight aria-hidden className="h-3 w-3" />
                  </button>
                )}
              </li>
            )
          })}
        </ol>

        {receipt && facts.run && (
          <div className="grid gap-6 border-t-2 border-ink px-6 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <MetricBreakdown run={facts.run} />
            <div className="space-y-2 text-body text-ink-2">
              <p className="font-semibold text-ink">What happened</p>
              <p>
                The baseline said <strong className="text-ink">{VERDICT_LABEL[facts.run.responses.baseline.verdict]}</strong>
                {baselineUnsafe(facts) ? <span className="text-risk"> (unsafe)</span> : null}. The check found{' '}
                <strong className="text-ink">{facts.evaluation?.findings.length ?? 0} issues</strong>. The guarded agent said{' '}
                <strong className="text-ink">{VERDICT_LABEL[facts.run.responses.guarded.verdict]}</strong>.
              </p>
              <p className="text-meta text-ink-3">
                Run <span className="font-mono">{receipt.runId}</span> · total = round(mean of four metrics) · scores below 50 in red · Graded by{' '}
                {facts.run.grader.label} · {SYNTHETIC_LABEL}
              </p>
              <p className="flex flex-wrap gap-x-4">
                <button type="button" onClick={() => onOpenDetail(LAST_STAGE_INDEX)} className="text-body font-medium text-primary underline-offset-4 hover:underline">
                  Open full receipt
                </button>
                <a href="score/index.html" className="inline-flex items-center gap-1 text-body font-medium text-primary underline-offset-4 hover:underline">
                  See benchmark-wide score
                  <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                </a>
              </p>
            </div>
          </div>
        )}
        {idle && (
          <p className="border-t border-rule px-6 py-3 text-body text-ink-2">
            Press <span className="font-semibold text-primary">Run benchmark</span> to walk through {scenario.id} left to right. Every
            stage has a <span className="font-medium">Details</span> link into the full view.
          </p>
        )}
      </section>
    </div>
  )
})
