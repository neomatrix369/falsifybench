import { LoaderCircle, ScanSearch, ShieldCheck } from 'lucide-react'
import { forwardRef, useRef, type ReactNode } from 'react'
import { SYNTHETIC_LABEL } from '../domain/provenance'
import { compareScores, formatDelta } from '../domain/scoring'
import { STAGES, STAGE_LABELS } from '../domain/stages'
import { VERDICT_LABEL } from '../domain/verdict'
import type { BenchmarkReceipt } from '../domain/receipt'
import type { WalkthroughState } from '../domain/walkthrough'
import type { GradedRun, Scenario, ScenarioEvaluation, WalkthroughStage } from '../domain/types'
import { AgentResponseCard } from './AgentResponseCard'
import { BracketSchematic } from './BracketSchematic'
import { Disclosure } from './Disclosure'
import { ReceiptView } from './ReceiptView'
import { ScoreCard } from './ScoreCard'
import { SourceAudit } from './SourceAudit'
import { TurnTrace } from './TurnTrace'

const FINAL_TABS: { label: string; stage: WalkthroughStage }[] = [
  { label: 'Verdict', stage: 'guarded' },
  { label: 'Evidence audit', stage: 'audit' },
  { label: 'Benchmark receipt', stage: 'receipt' },
]

function Why({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-rule pt-3 text-body text-ink-2">
      <span className="font-semibold text-ink">Why this happened: </span>
      {children}
    </p>
  )
}

function Loading() {
  return (
    <p role="status" className="flex items-center gap-2 text-body text-ink-3">
      <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> Unsealing audit fixture…
    </p>
  )
}

function OutcomeStrip({ evaluation, run }: { evaluation: ScenarioEvaluation; run: GradedRun }) {
  const { baselineTotal, guardedTotal, delta } = compareScores(run.scores.baseline, run.scores.guarded)
  const { baseline, guarded } = run.responses
  const baselineUnsafe = baseline.verdict !== evaluation.expectedSafeVerdict
  return (
    <p className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-y-2 border-ink py-3 text-body text-ink-2">
      <span className="flex flex-wrap items-baseline gap-x-2">
        Baseline{' '}
        <strong className={`text-lead ${baselineUnsafe ? 'text-risk' : 'text-ink'}`}>
          {VERDICT_LABEL[baseline.verdict]}
          {baselineUnsafe ? ' (unsafe)' : ''}
        </strong>{' '}
        <span className="text-ink-3">→</span> Guarded{' '}
        <strong className="text-lead text-warn">{VERDICT_LABEL[guarded.verdict]}</strong>
      </span>
      {' '}
      <span className="flex items-baseline gap-x-3">
        <span className="label">Score</span>{' '}
        <span className="font-mono text-reading text-ink-3">{baselineTotal}</span>{' '}
        <span className="text-title text-ink-3">→</span>{' '}
        <span className="font-mono text-reading font-semibold text-ink">{guardedTotal}</span>{' '}
        <strong className="font-mono text-title text-ok">({formatDelta(delta)})</strong>
      </span>
    </p>
  )
}

interface PanelProps {
  scenario: Scenario
  evaluation: ScenarioEvaluation | null
  /** The agents' answers and grades; arrives with the evaluation. */
  run: GradedRun | null
  receipt: BenchmarkReceipt | null
}

const PANELS: Record<WalkthroughStage, { headline: (p: PanelProps) => string; body: (p: PanelProps) => ReactNode }> = {
  evidence: {
    headline: ({ scenario }) => scenario.narrative.evidenceHeadline,
    body: ({ scenario }) => (
      <>
        <p className="max-w-[72ch] text-body text-ink-2">{scenario.narrative.evidenceIntro}</p>
        <table className="w-full text-body">
          <caption className="caption-top pb-1 text-left">
            <span className="sr-only">Visible evidence, </span>
            <span className="inline-flex items-center gap-1 text-meta font-medium text-ink-2">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-ok" />
              {SYNTHETIC_LABEL}
            </span>
          </caption>
          <thead>
            <tr className="border-y border-rule text-left text-meta text-ink-3">
              <th scope="col" className="py-1.5 font-medium">Evidence</th>
              <th scope="col" className="py-1.5 font-medium">Visible finding</th>
            </tr>
          </thead>
          <tbody>
            {scenario.evidence.map((item) => (
              <tr key={item.id} className="border-b border-rule align-top">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  <span className="block font-mono text-meta text-ink-3">{item.id}</span>
                  <span className="font-medium text-ink">{item.title}</span>
                </th>
                <td className="py-2 pr-3 text-ink-2">
                  {item.finding}
                  {item.excerpt && (
                    <blockquote className="mt-1.5 border-l border-rule-strong pl-3 font-mono text-meta text-ink-2">
                      “{item.excerpt}”
                    </blockquote>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {scenario.regions && <BracketSchematic regions={scenario.regions} />}
        <Why>The benchmark starts from a fixed, hand-audited evidence pack so every run is reproducible and comparable.</Why>
        <Disclosure>
          <p>Source: {scenario.provenance.source}. Audited by: {scenario.provenance.auditedBy}.</p>
          {scenario.thresholdMm !== undefined && (
            <p className="mt-1">Alert threshold: {scenario.thresholdMm} mm crack depth. Regions are a schematic visual aid only.</p>
          )}
        </Disclosure>
      </>
    ),
  },
  baseline: {
    headline: ({ scenario }) => scenario.narrative.baselineHeadline,
    body: ({ scenario }) => (
      <>
        <p className="max-w-[72ch] text-body text-ink-2">{scenario.narrative.baselineIntro}</p>
        <AgentResponseCard response={scenario.baseline} />
        {scenario.baselineTurns && (
          <TurnTrace label="Baseline run, turn by turn" turns={scenario.baselineTurns.map((action) => ({ by: 'agent', action }))} />
        )}
        <Why>{scenario.narrative.baselineWhy}</Why>
        <Disclosure>
          <p>The baseline response is a fixed, scripted fixture. No model was called; it represents a common failure pattern.</p>
        </Disclosure>
      </>
    ),
  },
  audit: {
    headline: ({ evaluation }) =>
      evaluation ? evaluation.narrative.auditHeadline : 'Running evidence audit…',
    body: ({ scenario, evaluation }) =>
      !evaluation ? (
        <Loading />
      ) : (
        <>
          <p className="max-w-[72ch] text-body text-ink-2">
            The falsification check asks: <em>{evaluation.narrative.auditQuestion}</em> {evaluation.narrative.auditAnswer}
          </p>
          <ul className="space-y-2">
            {evaluation.findings.map((finding) => (
              <li key={finding.id} className="flex gap-3 rounded-sm border border-warn-line/50 bg-warn-tint/60 px-3 py-2 text-body">
                <ScanSearch aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                <div>
                  <p className="font-medium text-ink">{finding.statement}</p>
                  <p className="mt-0.5 font-mono text-meta text-ink-2">{finding.evidenceIds.join(' · ')}</p>
                </div>
              </li>
            ))}
          </ul>
          {scenario.regions && evaluation.hiddenTruth.regionId ? (
            <BracketSchematic regions={scenario.regions} gapRegionId={evaluation.hiddenTruth.regionId} />
          ) : (
            <SourceAudit
              evidence={scenario.evidence}
              untrustedIds={evaluation.hiddenTruth.untrustedEvidenceIds ?? []}
              reason={evaluation.hiddenTruth.untrustedReason}
            />
          )}
          <Why>{evaluation.hiddenTruth.summary}</Why>
          <Disclosure>
            {evaluation.narrative.auditMethod ? (
              <p>{evaluation.narrative.auditMethod}</p>
            ) : (
              <p>
                Method: cross-check each claim's supporting readings against the coverage map and region stress roles. Readings in
                region {evaluation.hiddenTruth.regionId}: {evaluation.hiddenTruth.readingsInRegion}. Sampled regions:{' '}
                {evaluation.hiddenTruth.sampledRegionIds?.join(', ')}.
              </p>
            )}
            <p className="mt-1">Expected safe verdict for this fixture: {VERDICT_LABEL[evaluation.expectedSafeVerdict]}.</p>
          </Disclosure>
        </>
      ),
  },
  guarded: {
    headline: ({ evaluation }) => (evaluation ? evaluation.narrative.guardedHeadline : 'Preparing guarded verdict…'),
    body: ({ scenario, evaluation, run }) =>
      !evaluation || !run ? (
        <Loading />
      ) : (
        <>
          <p className="max-w-[72ch] text-body text-ink-2">{evaluation.narrative.guardedIntro}</p>
          <OutcomeStrip evaluation={evaluation} run={run} />
          <div className="grid grid-cols-2 gap-6">
            <AgentResponseCard response={scenario.baseline} unsafe />
            <AgentResponseCard response={run.responses.guarded} emphasis />
          </div>
          <p className="rounded-sm border border-rule bg-sunken px-3 py-2 text-body text-ink-2">
            <span className="font-semibold text-ink">Decided from public evidence: </span>
            <span className="font-mono text-meta">{evaluation.guardedBasis.join(' · ')}</span>. The answer key is used only to grade
            the two runs, never as input to either.
          </p>
          {evaluation.turns && scenario.baselineTurns && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="label mb-1">Baseline run · turns graded</p>
                <TurnTrace
                  label="Baseline run, graded"
                  turns={scenario.baselineTurns.map((action, i) => ({ by: 'agent', action, kind: evaluation.turns?.baseline[i] }))}
                />
              </div>
              <div>
                <p className="label mb-1">Guarded run · stop, advise, resume</p>
                <TurnTrace label="Guarded run, graded" turns={evaluation.turns.guarded} />
              </div>
            </div>
          )}
          <ScoreCard scores={run.scores} />
          <Why>{evaluation.narrative.guardedWhy}</Why>
          <Disclosure>
            <p>Sufficient next action: {evaluation.sufficientNextAction}</p>
            <p className="mt-1">Scores are fixture inputs on rubric {run.scores.rubricVersion}; totals are computed, not stored.</p>
          </Disclosure>
        </>
      ),
  },
  receipt: {
    headline: () => 'Benchmark receipt recorded',
    body: ({ receipt }) =>
      !receipt ? (
        <Loading />
      ) : (
        <>
          <p className="max-w-[72ch] text-body text-ink-2">
            A reproducible record of this run: what was shown, in which order, and how each path scored.
          </p>
          <ReceiptView receipt={receipt} />
        </>
      ),
  },
}

interface Props extends PanelProps {
  state: WalkthroughState
  onSelect: (index: number) => void
  /** Select a final-state tab without moving focus away from the tab list. */
  onSelectTab: (index: number) => void
}

export const ResultSurface = forwardRef<HTMLHeadingElement, Props>(function ResultSurface(
  { state, scenario, evaluation, run, receipt, onSelect, onSelectTab },
  headingRef,
) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  if (state.status === 'idle') {
    return (
      <section aria-labelledby="result-heading" className="sheet">
        <div className="border-b border-rule px-6 py-2">
          <p className="label">Ready</p>
        </div>
        <div className="px-6 pb-7 pt-5">
        <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="wide max-w-[30ch] text-display font-semibold text-ink focus:outline-none">
          {scenario.narrative.idleQuestion}
        </h2>
        <p className="mt-3 max-w-[68ch] text-lead text-ink-2">{scenario.narrative.idleClaim}</p>
        <ol className="mt-7 grid grid-cols-5 border-t-2 border-ink text-body">
          {STAGES.map((stage, i) => (
            <li key={stage} className="border-l border-rule px-3 pb-1 pt-2 first:border-l-0 first:pl-0">
              <span className="font-mono text-meta text-ink-3">{i + 1}</span>
              <p className="font-medium text-ink">{STAGE_LABELS[stage]}</p>
            </li>
          ))}
        </ol>
        <p className="mt-7 text-body text-ink-2">
          Press <span className="font-semibold text-primary">Run benchmark</span> to step through {scenario.id}. All data is{' '}
          <span className="font-medium">{SYNTHETIC_LABEL}</span>.
        </p>
        </div>
      </section>
    )
  }

  const stage = STAGES[state.cursor]
  const panel = PANELS[stage]
  const props = { scenario, evaluation, run, receipt }

  return (
    <section aria-labelledby="result-heading" className="sheet">
      {state.status === 'complete' && (
        <div
          role="tablist"
          aria-label="Final results"
          className="flex gap-1 border-b border-rule px-4 pt-2"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            e.preventDefault()
            const current = FINAL_TABS.findIndex((t) => STAGES.indexOf(t.stage) === state.cursor)
            const step = e.key === 'ArrowRight' ? 1 : -1
            const nextTab = (Math.max(current, 0) + step + FINAL_TABS.length) % FINAL_TABS.length
            onSelectTab(STAGES.indexOf(FINAL_TABS[nextTab].stage))
            tabRefs.current[nextTab]?.focus()
          }}
        >
          {FINAL_TABS.map((tab, tabIndex) => {
            const index = STAGES.indexOf(tab.stage)
            const selected = state.cursor === index
            const anySelected = FINAL_TABS.some((t) => STAGES.indexOf(t.stage) === state.cursor)
            const focusable = selected || (!anySelected && tabIndex === 0)
            return (
              <button
                key={tab.stage}
                type="button"
                role="tab"
                ref={(el) => {
                  tabRefs.current[tabIndex] = el
                }}
                tabIndex={focusable ? 0 : -1}
                aria-selected={selected}
                onClick={() => onSelect(index)}
                className={`-mb-px border-b-2 px-3 py-2 text-body font-medium transition-colors duration-fast ${
                  selected ? 'border-primary text-ink' : 'border-transparent text-ink-3 hover:border-rule-strong hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}
      <div className="space-y-5 px-6 pb-6 pt-4" role={state.status === 'complete' ? 'tabpanel' : undefined}>
        <div>
          <p className="ref">
            Stage {state.cursor + 1} · {STAGE_LABELS[stage]}
          </p>
          <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="wide mt-1 text-display font-semibold text-ink focus:outline-none">
            {panel.headline(props)}
          </h2>
        </div>
        {panel.body(props)}
      </div>
    </section>
  )
})
