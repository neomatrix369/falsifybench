import { ArrowUpRight, ShieldCheck, TrendingUp } from 'lucide-react'
import { METRIC_KEYS, METRIC_LABELS, compareScores, formatDelta } from '../domain/scoring'
import { SCRIPTED_FIXTURE_LABEL } from '../domain/provenance'
import type { GraderIdentity, RubricScores } from '../domain/types'
import { ScoreMath } from './ScoreMath'

function Bar({ value, tone }: { value: number; tone: 'baseline' | 'guarded' }) {
  return (
    <div className="h-1.5 w-full bg-sunken ring-1 ring-inset ring-rule" aria-hidden>
      <div className={`h-1.5 ${tone === 'guarded' ? 'bg-primary' : 'bg-rule-strong'}`} style={{ width: `${value}%` }} />
    </div>
  )
}

export function ScoreCard({
  scores,
  grader,
  unsafeApprovalPrevented = true,
}: {
  scores: RubricScores
  grader?: GraderIdentity
  /** False when this run's baseline did not approve (e.g. a live baseline that investigated), so nothing was prevented. */
  unsafeApprovalPrevented?: boolean
}) {
  const { baseline, guarded, rubricVersion } = scores
  const { baselineTotal, guardedTotal, delta } = compareScores(baseline, guarded)
  return (
    <section aria-labelledby="scorecard-title" className="border-t-2 border-ink">
      <div className="flex items-baseline justify-between py-2">
        <h3 id="scorecard-title" className="text-body font-semibold text-ink">
          Benchmark scorecard <span className="font-mono font-normal text-ink-3">· {rubricVersion}</span>
        </h3>
        <p className="label">{!grader || grader.id === 'fixture-grader' ? SCRIPTED_FIXTURE_LABEL : `Graded by ${grader.label}`}</p>
      </div>
      <table className="w-full text-body">
        <caption className="sr-only">Baseline versus guarded scores, 0 to 100</caption>
        <thead>
          <tr className="border-y border-rule text-left text-meta text-ink-3">
            <th scope="col" className="py-1.5 pr-4 font-medium">Metric</th>
            <th scope="col" className="w-[30%] px-4 py-1.5 font-medium">Baseline</th>
            <th scope="col" className="w-[30%] py-1.5 pl-4 font-medium">Guarded</th>
          </tr>
        </thead>
        <tbody>
          {METRIC_KEYS.map((key) => (
            <tr key={key} className="border-b border-rule">
              <th scope="row" className="py-1.5 pr-4 text-left font-normal text-ink-2">{METRIC_LABELS[key]}</th>
              <td className="px-4 py-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-7 text-right font-mono">{baseline[key]}</span>
                  <Bar value={baseline[key]} tone="baseline" />
                </div>
              </td>
              <td className="py-1.5 pl-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 text-right font-mono">{guarded[key]}</span>
                  <Bar value={guarded[key]} tone="guarded" />
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-b-2 border-ink font-semibold">
            <th scope="row" className="py-2 pr-4 text-left">Total</th>
            <td className="px-4 py-2 font-mono text-title">{baselineTotal}</td>
            <td className="py-2 pl-4 font-mono text-title text-primary">{guardedTotal}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-lead font-semibold text-ok">
          <TrendingUp aria-hidden className="h-4 w-4" />
          {formatDelta(delta)} release-readiness points
        </span>
        {unsafeApprovalPrevented && (
          <span className="inline-flex items-center gap-1 text-meta font-semibold text-ok">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
            Unsafe approval prevented
          </span>
        )}
        <span className="ml-auto text-meta text-ink-3">Total = round(mean of four metrics). Benchmark demonstration, not a validated scientific result.</span>
      </div>
      <ScoreMath baseline={baseline} guarded={guarded} />
      <a
        href="score/index.html"
        className="inline-flex items-center gap-1 text-body font-medium text-primary underline-offset-4 hover:underline"
      >
        See benchmark-wide score
        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
      </a>
    </section>
  )
}
