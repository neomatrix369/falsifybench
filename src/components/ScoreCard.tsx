import { ShieldCheck, TrendingUp } from 'lucide-react'
import { METRIC_KEYS, METRIC_LABELS, compareScores, formatDelta } from '../domain/scoring'
import { SCRIPTED_FIXTURE_LABEL } from '../domain/provenance'
import type { ScenarioEvaluation } from '../domain/types'
import { StatusPill } from './StatusPill'

function Bar({ value, tone }: { value: number; tone: 'slate' | 'indigo' }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100" aria-hidden>
      <div className={`h-1.5 rounded-full ${tone === 'indigo' ? 'bg-indigo-500' : 'bg-slate-400'}`} style={{ width: `${value}%` }} />
    </div>
  )
}

export function ScoreCard({ evaluation }: { evaluation: ScenarioEvaluation }) {
  const { baseline, guarded, rubricVersion } = evaluation.scoring
  const { baselineTotal, guardedTotal, delta } = compareScores(baseline, guarded)
  return (
    <section aria-labelledby="scorecard-title" className="rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <h3 id="scorecard-title" className="text-sm font-semibold text-slate-800">
          Benchmark scorecard <span className="font-normal text-slate-500">· {rubricVersion}</span>
        </h3>
        <StatusPill>{SCRIPTED_FIXTURE_LABEL}</StatusPill>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Baseline versus guarded scores, 0 to 100</caption>
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th scope="col" className="px-4 py-2 font-medium">Metric</th>
            <th scope="col" className="w-[30%] px-4 py-2 font-medium">Baseline</th>
            <th scope="col" className="w-[30%] px-4 py-2 font-medium">Guarded</th>
          </tr>
        </thead>
        <tbody>
          {METRIC_KEYS.map((key) => (
            <tr key={key} className="border-t border-slate-100">
              <th scope="row" className="px-4 py-2 text-left font-normal text-slate-700">{METRIC_LABELS[key]}</th>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-right font-mono tabular-nums">{baseline[key]}</span>
                  <Bar value={baseline[key]} tone="slate" />
                </div>
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-right font-mono tabular-nums">{guarded[key]}</span>
                  <Bar value={guarded[key]} tone="indigo" />
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-200 font-semibold">
            <th scope="row" className="px-4 py-2 text-left">Total</th>
            <td className="px-4 py-2 font-mono text-lg tabular-nums">{baselineTotal}</td>
            <td className="px-4 py-2 font-mono text-lg tabular-nums text-indigo-700">{guardedTotal}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-emerald-50/50 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-base font-semibold text-emerald-800">
          <TrendingUp aria-hidden className="h-4 w-4" />
          {formatDelta(delta)} release-readiness points
        </span>
        <StatusPill tone="green" icon={<ShieldCheck aria-hidden className="h-3 w-3" />}>
          Unsafe approval prevented
        </StatusPill>
        <span className="ml-auto text-[11px] text-slate-500">Total = round(mean of four metrics). Benchmark demonstration, not a validated scientific result.</span>
      </div>
    </section>
  )
}
