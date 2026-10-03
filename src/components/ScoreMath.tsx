import { METRIC_KEYS, METRIC_LABELS, compareScores, formatDelta } from '../domain/scoring'
import { SCORE_EQUATIONS, scoreLegend, workedDelta, workedTotal } from '../domain/scoreMath'
import type { MetricScores } from '../domain/types'

// MathML strings come from src/domain/scoreMath (static markup, escaped values).
function MathML({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

const LEGEND = scoreLegend({ metricLabels: METRIC_KEYS.map((k) => METRIC_LABELS[k]) })

export function ScoreMath({ baseline, guarded }: { baseline: MetricScores; guarded: MetricScores }) {
  const { baselineTotal, guardedTotal, delta } = compareScores(baseline, guarded)
  return (
    <section aria-labelledby="score-math-title" className="my-3 border border-rule bg-sunken px-4 py-3">
      <h4 id="score-math-title" className="text-body font-semibold text-ink">How the score is computed</h4>
      <div className="mt-2 space-y-4">
        <div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 overflow-x-auto">
            {SCORE_EQUATIONS.map((e) => (
              <div key={e.label} className="contents">
                <dt className="label whitespace-nowrap">{e.label}</dt>
                <dd className="score-math">
                  <MathML html={e.mathml} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 space-y-1.5 border-t border-rule pt-2.5 text-meta text-ink-2">
            <p className="label">This scenario</p>
            <p className="score-math"><MathML html={workedTotal('guarded', METRIC_KEYS.map((k) => guarded[k]), guardedTotal)} /></p>
            <p className="score-math"><MathML html={workedTotal('baseline', METRIC_KEYS.map((k) => baseline[k]), baselineTotal)} /></p>
            <p className="score-math"><MathML html={workedDelta(guardedTotal, baselineTotal, formatDelta(delta))} /></p>
          </div>
        </div>
        <div>
          <p className="label">Legend</p>
          <dl className="mt-1.5 grid gap-x-6 gap-y-1.5 text-meta md:grid-cols-2">
            {LEGEND.map((l) => (
              <div key={l.text} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-3">
                <dt className="score-math text-right"><MathML html={l.symbol} /></dt>
                <dd className="text-ink-2">{l.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
