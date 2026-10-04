import { Bot, Play, ShieldCheck, ShieldHalf } from 'lucide-react'
import { forwardRef } from 'react'
import type { Scenario, ScenarioBrief } from '../domain/types'

const BRIEF_ROWS: [keyof ScenarioBrief, string][] = [
  ['agent', 'Agent'],
  ['task', 'Task'],
  ['input', 'What it sees'],
  ['checks', 'FalsifyBench checks'],
]

interface Props {
  scenario: Scenario
  /** Sources the unsealed audit excluded; empty before the Audit stage. */
  excludedIds: string[]
  excludedReason?: string
  canRun: boolean
  onRun: () => void
}

export const ScenarioCard = forwardRef<HTMLHeadingElement, Props>(function ScenarioCard({ scenario, excludedIds, excludedReason = 'instruction', canRun, onRun }, ref) {
  const quoted = scenario.evidence.filter((item) => item.excerpt)
  return (
    <section aria-labelledby="active-scenario-title" className="sheet">
      <div className="flex items-center justify-between border-b border-rule px-5 py-2">
        <p className="label">Active benchmark</p>
        <p className="ref text-ink-2">
          {scenario.id} · v{scenario.version}
        </p>
      </div>
      <div className="px-5 pb-5 pt-4">
        <h2 id="active-scenario-title" ref={ref} tabIndex={-1} className="wide text-title font-semibold text-ink">
          {scenario.title}
        </h2>
        <p className="mt-1 text-body text-ink-2">{scenario.question}</p>

        <section aria-label="What’s being tested" className="mt-3 rounded-sm border border-rule px-3 py-2">
          <p className="label">What’s being tested</p>
          <dl className="mt-1 space-y-1 text-meta">
            {BRIEF_ROWS.map(([key, term]) => (
              <div key={key} className="grid grid-cols-[7.5rem_1fr] gap-x-2">
                <dt className="font-medium text-ink">{term}</dt>
                <dd className="text-ink-2">{scenario.brief[key]}</dd>
              </div>
            ))}
          </dl>
        </section>

        {quoted.map((item) => {
          const excluded = excludedIds.includes(item.id)
          return (
            <figure
              key={item.id}
              aria-label={`Verbatim text in ${item.id}`}
              className={`mt-3 rounded-sm border px-3 py-2 ${excluded ? 'border-risk-line bg-risk-tint/60' : 'border-rule bg-sunken'}`}
            >
              <figcaption className="flex items-baseline justify-between gap-2 text-meta">
                <span>
                  <span className="font-mono text-ink-3">{item.id}</span>{' '}
                  <span className="font-medium text-ink">{item.title}</span>
                  <span className="text-ink-3"> · verbatim</span>
                </span>
                {excluded && <span className="shrink-0 font-medium text-risk">Excluded · {excludedReason}</span>}
              </figcaption>
              <blockquote className="mt-1 font-mono text-meta text-ink-2">“{item.excerpt}”</blockquote>
            </figure>
          )
        })}

        <dl className="mt-3 divide-y divide-rule border-y border-rule text-body">
          <div className="flex items-center gap-2.5 py-1.5">
            <dt className="sr-only">Baseline</dt>
            <Bot aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
            <dd className="text-ink">{scenario.baseline.agentLabel}</dd>
          </div>
          <div className="flex items-center gap-2.5 py-1.5">
            <dt className="sr-only">Guardrail</dt>
            <ShieldHalf aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
            <dd className="text-ink">{scenario.guardedAgentLabel}</dd>
          </div>
          <div className="flex items-center gap-2.5 py-1.5">
            <dt className="sr-only">Provenance</dt>
            <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-ok" />
            <dd className="text-ink-2">Provenance: {scenario.provenance.label}</dd>
          </div>
        </dl>

        <button type="button" className="btn-primary mt-4 w-full py-2.5 text-lead" disabled={!canRun} onClick={onRun}>
          <Play aria-hidden className="h-4 w-4" />
          Run benchmark
        </button>
        {!canRun && <p className="mt-2 text-center text-meta text-ink-3">Walkthrough in progress — use the trace controls below.</p>}
      </div>
    </section>
  )
})
