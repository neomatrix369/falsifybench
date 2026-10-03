import { Bot, Play, ShieldCheck, ShieldHalf } from 'lucide-react'
import { forwardRef } from 'react'
import type { Scenario } from '../domain/types'
import { StatusPill } from './StatusPill'

interface Props {
  scenario: Scenario
  canRun: boolean
  onRun: () => void
}

export const ScenarioCard = forwardRef<HTMLHeadingElement, Props>(function ScenarioCard({ scenario, canRun, onRun }, ref) {
  return (
    <section aria-labelledby="active-scenario-title" className="card p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Active benchmark</p>
        <StatusPill tone="indigo">
          {scenario.id} · v{scenario.version}
        </StatusPill>
      </div>
      <h2
        id="active-scenario-title"
        ref={ref}
        tabIndex={-1}
        className="mt-2 text-lg font-semibold leading-snug text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {scenario.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{scenario.question}</p>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Baseline</dt>
          <Bot aria-hidden className="h-4 w-4 text-slate-500" />
          <dd>{scenario.baseline.agentLabel}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Guardrail</dt>
          <ShieldHalf aria-hidden className="h-4 w-4 text-slate-500" />
          <dd>{scenario.guardedAgentLabel}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Provenance</dt>
          <dd>
            <StatusPill tone="green" icon={<ShieldCheck aria-hidden className="h-3 w-3" />}>
              Provenance: {scenario.provenance.label}
            </StatusPill>
          </dd>
        </div>
      </dl>

      <button type="button" className="btn-primary mt-5 w-full py-2.5 text-base" disabled={!canRun} onClick={onRun}>
        <Play aria-hidden className="h-4 w-4" />
        Run benchmark
      </button>
      {!canRun && <p className="mt-2 text-center text-xs text-slate-500">Walkthrough in progress — use the trace controls below.</p>}
    </section>
  )
})
