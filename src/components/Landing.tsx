import { ArrowRight, ExternalLink, FlaskConical, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BRAND } from '../config/branding'
import {
  CHALLENGES,
  INDUSTRY_FINDINGS,
  METRIC_QUESTIONS,
  POSITIONING,
  REPO_URL,
  AGENT_SCIENCE_LINE,
  type ThemeStatus,
  SCIENCE_AGENT_THEMES,
  RESEARCH_QUOTES,
  ROADMAP,
  SCENARIO_PACKS,
  INDUSTRY_TICKER,
  type FindingTone,
  type TickerItem,
} from '../config/landing'
import { comingNextPreviews } from '../data/previews'
import { RUNNABLE_BENCHMARKS, syntheticScenarioSource } from '../data/scenarioSource'
import type { BenchmarkScore, IntegrityCheck } from '../domain/benchmarkScore'
import { SCRIPTED_FIXTURE_LABEL, SYNTHETIC_LABEL } from '../domain/provenance'
import { METRIC_KEYS, METRIC_LABELS, formatDelta } from '../domain/scoring'
import { STAGES, STAGE_LABELS } from '../domain/stages'
import type { Scenario } from '../domain/types'
import { Header, type View } from './Header'
import { FalsificationStrip, Ticker } from './LandingMotion'

const THEME_STATUS: Record<ThemeStatus, { label: string; className: string }> = {
  covered: { label: 'Covered', className: 'text-ok' },
  partial: { label: 'Partly covered', className: 'text-warn' },
  'not-yet': { label: 'Not yet', className: 'text-ink-3' },
}

export const SCORE_JSON_URL = 'score/score.json'

type PublishedScore = BenchmarkScore & { fingerprint?: string; benchmarkGates?: IntegrityCheck[] }

const TONE_INK: Record<FindingTone, string> = { risk: 'text-risk', warn: 'text-warn' }
const TONE_RULE: Record<FindingTone, string> = { risk: 'border-risk-line', warn: 'border-warn-line' }

const STAGE_NOTES: Record<(typeof STAGES)[number], string> = {
  evidence: 'The evidence pack the agents see, exactly as received.',
  baseline: 'A confident agent’s claim, verdict and stated confidence.',
  audit: 'The sealed answer key is unsealed and every claim is checked against it.',
  guarded: 'The guarded path’s verdict and its proposed falsifying test.',
  receipt: 'A JSON receipt of inputs, timings, verdicts and computed scores.',
}

function isPublishedScore(value: unknown): value is PublishedScore {
  const v = value as PublishedScore | null
  return !!v && Array.isArray(v.scenarios) && !!v.agents?.baseline && !!v.agents?.guarded && typeof v.meanDelta === 'number'
}

function usePublishedScore() {
  const [score, setScore] = useState<PublishedScore | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(SCORE_JSON_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: unknown) => {
        if (cancelled) return
        if (isPublishedScore(json)) setScore(json)
        else setFailed(true)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])
  return { score, failed }
}

function useRunnableScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  useEffect(() => {
    let cancelled = false
    Promise.all(RUNNABLE_BENCHMARKS.map((b) => syntheticScenarioSource.loadScenario(b.id))).then(
      (loaded) => !cancelled && setScenarios(loaded),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])
  return scenarios
}

function Section({ id, index, title, intro, children }: { id: string; index: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="sheet rise-on-scroll">
      <div className="border-b-2 border-ink px-6 pb-3 pt-5">
        <p className="ref">{index}</p>
        <h2 id={`${id}-title`} className="wide mt-0.5 text-title font-semibold text-ink">
          {title}
        </h2>
        {intro && <p className="mt-1 max-w-3xl text-body text-ink-2">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-meta text-ink-3 underline decoration-rule-strong hover:text-ink">
      {children}
      <ExternalLink aria-hidden className="h-3 w-3" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

const pct = (n: number, d: number) => `${n}/${d}`

function ResultsBody({ score }: { score: PublishedScore }) {
  const { baseline, guarded } = score.agents
  const gates = [...score.scenarios.flatMap((s) => s.integrity), ...(score.benchmarkGates ?? [])]
  const gateIds = [...new Set(gates.map((g) => g.id))]
  const passed = gates.filter((g) => g.ok).length
  return (
    <>
      <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
        <div className="px-6 py-5">
          <p className="label">Score (guarded)</p>
          <p className="mt-1 font-mono text-reading font-semibold text-primary">{guarded.score}</p>
        </div>
        <div className="px-6 py-5">
          <p className="label">Score (baseline)</p>
          <p className="mt-1 font-mono text-reading font-semibold text-risk">{baseline.score}</p>
        </div>
        <div className="px-6 py-5">
          <p className="label">Mean Δ, guarded − baseline</p>
          <p className="mt-1 font-mono text-reading font-semibold text-ok">{formatDelta(score.meanDelta)}</p>
        </div>
      </div>
      <table className="w-full text-body">
        <caption className="sr-only">Benchmark-wide results by agent</caption>
        <thead>
          <tr className="border-b border-rule text-left text-meta text-ink-3">
            <th scope="col" className="px-6 py-2 font-medium">
              Measure
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Baseline agent
            </th>
            <th scope="col" className="px-6 py-2 font-medium">
              Guarded path
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          <tr>
            <th scope="row" className="px-6 py-2 text-left font-normal text-ink-2">
              Safe verdicts
            </th>
            <td className="px-3 py-2 font-mono">{pct(baseline.safeVerdicts, baseline.scenarios)}</td>
            <td className="px-6 py-2 font-mono">{pct(guarded.safeVerdicts, guarded.scenarios)}</td>
          </tr>
          <tr>
            <th scope="row" className="px-6 py-2 text-left font-normal text-ink-2">
              Unsafe approvals
            </th>
            <td className="px-3 py-2 font-mono text-risk">{pct(baseline.unsafeApprovals, baseline.scenarios)}</td>
            <td className="px-6 py-2 font-mono">{pct(guarded.unsafeApprovals, guarded.scenarios)}</td>
          </tr>
          <tr>
            <th scope="row" className="px-6 py-2 text-left font-normal text-ink-2">
              Unsafe approvals prevented
            </th>
            <td className="px-3 py-2 text-ink-3">—</td>
            <td className="px-6 py-2 font-mono text-ok">{pct(score.unsafeApprovalsPrevented, baseline.unsafeApprovals)}</td>
          </tr>
          <tr>
            <th scope="row" className="px-6 py-2 text-left font-normal text-ink-2">
              Data-integrity gates
            </th>
            <td colSpan={2} className="px-3 py-2">
              <span className="font-mono">
                {passed}/{gates.length}
              </span>{' '}
              checks pass across {gateIds.length} gates ({gateIds.join(', ')}), G = {score.gate}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-rule px-6 py-3 text-meta text-ink-3">
        Read from the published <span className="font-mono">{SCORE_JSON_URL}</span>
        {score.fingerprint && (
          <>
            {' '}
            (data fingerprint <span className="font-mono">{score.fingerprint}</span>)
          </>
        )}
        . {SCRIPTED_FIXTURE_LABEL}. Per-scenario detail is on the{' '}
        <a href="score/index.html" className="text-primary underline">
          benchmark score page
        </a>
        .
      </p>
    </>
  )
}

export function Landing({ onSwitchView }: { onSwitchView: (view: View) => void }) {
  const { score, failed } = usePublishedScore()
  const scenarios = useRunnableScenarios()
  const evidenceCount = scenarios.reduce((n, s) => n + s.evidence.length, 0)
  const runnableIds = new Set(RUNNABLE_BENCHMARKS.map((b) => b.id))
  const previewIds = new Set(comingNextPreviews.map((p) => p.id))
  const open = () => onSwitchView('benchmark')
  const tickerItems: TickerItem[] = [
    ...INDUSTRY_TICKER,
    ...(score
      ? [
          { figure: String(score.agents.guarded.score), text: `guarded vs ${score.agents.baseline.score} baseline on FalsifyBench’s synthetic fixtures`, tone: 'own' as const },
          {
            figure: `${score.agents.baseline.unsafeApprovals}/${score.agents.baseline.scenarios}`,
            text: 'unsafe approvals by the baseline agent, caught before release',
            tone: 'own' as const,
          },
        ]
      : []),
  ]

  return (
    <>
      <Header view="about" onSwitchView={onSwitchView} />
      <Ticker items={tickerItems} />
      <main className="mx-auto max-w-page space-y-4 px-6 py-6">
        <section aria-labelledby="landing-title" className="sheet grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="border-r border-rule px-8 py-8">
            <p className="inline-flex items-center gap-1.5 text-meta text-ink-3">
              <FlaskConical aria-hidden className="h-3.5 w-3.5" />
              {BRAND.name} · {SYNTHETIC_LABEL} proof of concept
            </p>
            <h1 id="landing-title" tabIndex={-1} className="wide mt-3 max-w-2xl text-reading font-semibold text-ink focus:outline-none">
              A confident science agent is not the same as a supported decision.
            </h1>
            <p className="mt-4 max-w-2xl text-lead text-ink">
              <span className="font-semibold">{BRAND.name}:</span> {POSITIONING.charAt(0).toLowerCase() + POSITIONING.slice(1)}
            </p>
            <p className="mt-3 max-w-2xl text-body text-ink-2">{BRAND.claim}</p>
            <p className="mt-2 max-w-2xl text-body text-ink-2">{AGENT_SCIENCE_LINE}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary px-4 py-2.5 text-lead" data-view-switch="benchmark" onClick={open}>
                Open the benchmark
                <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
              <a href="score/index.html" className="btn-secondary px-4 py-2.5">
                Benchmark score
              </a>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 text-body text-ink-2 underline decoration-rule-strong hover:text-ink">
                View the repo
                <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </div>
          <div className="bg-sunken/60 px-6 py-6">
            <h2 className="text-body font-semibold text-ink">One primitive, every scenario</h2>
            <p className="mt-1 text-meta text-ink-3">Evidence → agent claim + confidence → falsification check → verdict + score</p>
            <ol className="mt-4 divide-y divide-rule border-y border-rule">
              {STAGES.map((stage, i) => (
                <li key={stage} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 py-2.5">
                  <span className="font-mono text-meta text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="block text-body font-medium text-ink">{STAGE_LABELS[stage]}</span>
                    <span className="block text-meta text-ink-2">{STAGE_NOTES[stage]}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="col-span-2">
            <FalsificationStrip />
          </div>
        </section>

        <Section
          id="problem"
          index="01"
          title="Agents are trusted faster than they are tested"
          intro="Science and engineering agents now read evidence, call tools and recommend releases. The open problem is not whether they sound right, but whether anyone can show they are safe to rely on."
        >
          <div className="grid grid-cols-2 divide-x divide-rule border-b border-rule">
            {CHALLENGES.map((c) => (
              <figure key={c} className="px-6 py-4">
                <figcaption className="label">Challenge statement</figcaption>
                <blockquote className="mt-1 text-lead text-ink">“{c}”</blockquote>
              </figure>
            ))}
          </div>
          <h3 className="px-6 pt-4 text-body font-semibold text-ink">Industry readings on agent safety, reliability and robustness</h3>
          <p className="px-6 text-meta text-ink-3">
            <span className="text-risk">Red</span>: observed failures and harm. <span className="text-warn">Amber</span>: reliability gaps and trends.
          </p>
          <ul className="mt-3 grid grid-cols-3 border-t border-rule [&>li:nth-child(3n)]:border-r-0 [&>li:nth-child(n+4)]:border-b-0">
            {INDUSTRY_FINDINGS.map((f) => (
              <li key={f.figure + f.source} className="flex flex-col border-b border-r border-rule px-6 py-4">
                <p className="flex items-baseline justify-between gap-2">
                  <span className={`font-mono text-display font-semibold ${TONE_INK[f.tone]}`}>{f.figure}</span>
                  <span className={`border-b-2 pb-0.5 text-meta font-medium text-ink-2 ${TONE_RULE[f.tone]}`}>{f.theme}</span>
                </p>
                <p className="mt-2 flex-1 text-body text-ink-2">{f.claim}</p>
                <p className="mt-3 border-t border-dashed border-rule pt-2">
                  <SourceLink href={f.href}>{f.source}</SourceLink>
                </p>
              </li>
            ))}
          </ul>
          <p className="border-t border-rule px-6 py-3 text-meta text-ink-3">
            Figures are quoted as published by each source and link to it. {BRAND.name} did not reproduce them; its own numbers are in section 05.
          </p>
        </Section>

        <Section id="research" index="02" title="What the research says, and how the benchmark answers it">
          <ul className="grid grid-cols-2 divide-x divide-rule">
            {RESEARCH_QUOTES.map((q) => (
              <li key={q.href} className="px-6 py-5">
                <blockquote className="text-lead text-ink">“{q.quote}”</blockquote>
                <p className="mt-1">
                  <SourceLink href={q.href}>{q.source}</SourceLink>
                </p>
                <p className="mt-3 border-t border-rule pt-3 text-body text-ink-2">
                  <span className="font-medium text-ink">In {BRAND.name}: </span>
                  {q.answer}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="measures"
          index="03"
          title="What gets scored"
          intro="Four rubric metrics, each an integer from 0 to 100, for both the baseline agent and the guarded path. The total is round(mean(…)), always computed and never stored in a fixture."
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] divide-x divide-rule">
            <table className="w-full text-body">
              <caption className="px-6 pt-4 text-left text-body font-semibold text-ink">Rubric</caption>
              <tbody className="divide-y divide-rule">
                {METRIC_KEYS.map((key, i) => (
                  <tr key={key}>
                    <td className="w-10 py-2.5 pl-6 align-top font-mono text-meta text-ink-3">M{i + 1}</td>
                    <th scope="row" className="w-44 py-2.5 pr-3 text-left align-top font-medium text-ink">
                      {METRIC_LABELS[key]}
                    </th>
                    <td className="py-2.5 pr-6 text-ink-2">{METRIC_QUESTIONS[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full text-body">
              <caption className="px-6 pt-4 text-left text-body font-semibold text-ink">
                Science-agent themes → what {BRAND.name} covers
              </caption>
              <tbody className="divide-y divide-rule">
                {SCIENCE_AGENT_THEMES.map((t) => (
                  <tr key={t.theme} className={t.status === 'not-yet' ? 'text-ink-3' : undefined}>
                    <th
                      scope="row"
                      className={`w-44 py-2.5 pl-6 pr-3 text-left align-top font-medium ${t.status === 'not-yet' ? '' : 'text-ink'}`}
                    >
                      {t.theme}
                      <span className={`mt-1 block font-mono text-meta ${THEME_STATUS[t.status].className}`}>
                        {THEME_STATUS[t.status].label}
                      </span>
                    </th>
                    <td className={`py-2.5 pr-6 ${t.status === 'not-yet' ? '' : 'text-ink-2'}`}>
                      <span className={`block ${t.status === 'not-yet' ? '' : 'text-ink'}`}>{t.ask}</span>
                      {t.evidence}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          id="packs"
          index="04"
          title="Scenario packs"
          intro="One harness and one evaluation primitive, with small, auditable cases grouped by the failure they expose. No separate products."
        >
          <table className="w-full text-body">
            <caption className="sr-only">Scenario packs and the benchmarks that cover them</caption>
            <thead>
              <tr className="border-b border-rule text-left text-meta text-ink-3">
                <th scope="col" className="px-6 py-2 font-medium">
                  Pack
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Detects
                </th>
                <th scope="col" className="px-6 py-2 font-medium">
                  Coverage today
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {SCENARIO_PACKS.map((p) => (
                <tr key={p.pack}>
                  <th scope="row" className="w-56 px-6 py-2.5 text-left align-top font-medium text-ink">
                    {p.pack}
                  </th>
                  <td className="px-3 py-2.5 align-top text-ink-2">{p.detects}</td>
                  <td className="w-72 px-6 py-2.5 align-top">
                    {p.ids.map((id) => {
                      const runnable = runnableIds.has(id)
                      return (
                        <span key={id} className="inline-flex items-center gap-1.5">
                          <span className="rounded-sm border border-rule-strong px-1 font-mono text-meta text-ink">{id}</span>
                          {runnable ? (
                            <span className="text-meta text-ok">Runnable</span>
                          ) : previewIds.has(id) ? (
                            <span className="inline-flex items-center gap-1 text-meta text-ink-3">
                              <Lock aria-hidden className="h-3 w-3" /> Preview · not runnable
                            </span>
                          ) : null}
                        </span>
                      )
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="grid grid-cols-2 divide-x divide-rule border-t border-rule">
            {scenarios.map((s) => {
              const meta = RUNNABLE_BENCHMARKS.find((b) => b.id === s.id)
              const quoted = s.evidence.find((e) => e.excerpt)
              return (
                <li key={s.id} className="px-6 py-4">
                  <p className="ref">
                    {s.id} · v{s.version} · {meta?.track}
                  </p>
                  <h3 className="wide mt-0.5 text-body font-semibold text-ink">
                    {meta?.title}: {s.title}
                  </h3>
                  <p className="mt-1 text-body text-ink-2">{s.question}</p>
                  {quoted && (
                    <blockquote className="mt-2 rounded-sm border border-rule bg-sunken px-3 py-2 font-mono text-meta text-ink-2">
                      <span className="text-ink-3">{quoted.id} · verbatim: </span>“{quoted.excerpt}”
                    </blockquote>
                  )}
                  <dl className="mt-3 grid grid-cols-3 gap-x-4 border-t border-rule pt-2 text-meta">
                    <div>
                      <dt className="text-ink-3">Evidence records</dt>
                      <dd className="font-mono text-body text-ink">{s.evidence.length}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Baseline confidence</dt>
                      <dd className="font-mono text-body text-ink">{s.baseline.confidenceLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Answer key</dt>
                      <dd className="text-body text-ink">Sealed until Audit</dd>
                    </div>
                  </dl>
                </li>
              )
            })}
          </ul>
        </Section>

        <Section
          id="results"
          index="05"
          title="Current results on the synthetic data"
          intro="Simulated baseline and guarded agents, scored by npm run score from the benchmark data only, never the codebase. Any failed data-integrity gate sets G = 0 and the score is not reported."
        >
          {score ? (
            <ResultsBody score={score} />
          ) : (
            <p className="px-6 py-4 text-body text-ink-2" role="status">
              {failed ? (
                <>
                  The published score could not be read here. Open the{' '}
                  <a href="score/index.html" className="text-primary underline">
                    benchmark score page
                  </a>
                  .
                </>
              ) : (
                'Reading the published score…'
              )}
            </p>
          )}
        </Section>

        <Section id="poc" index="06" title="What this proof of concept is, and isn’t">
          <dl className="grid grid-cols-6 divide-x divide-rule">
            {[
              { k: 'Runnable scenarios', v: String(RUNNABLE_BENCHMARKS.length) },
              { k: 'Previewed scenarios', v: String(comingNextPreviews.length) },
              { k: 'Walkthrough stages', v: String(STAGES.length) },
              { k: 'Evidence records', v: evidenceCount ? String(evidenceCount) : '…' },
              { k: 'Model calls', v: '0' },
              { k: 'Secrets needed', v: '0' },
            ].map((f) => (
              <div key={f.k} className="px-6 py-4">
                <dt className="text-meta text-ink-3">{f.k}</dt>
                <dd className="mt-1 font-mono text-display font-semibold text-ink">{f.v}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-rule px-6 py-3 text-body text-ink-2">
            Every fixture is synthetic and hand-audited: no real component, supplier, partner, sponsor or validated study is involved, and no inference
            runs anywhere. Each answer key lives in its own lazily loaded chunk and is unsealed only at the Audit stage. Partner data and live agents
            stay disabled until a validated source exists.
          </p>
        </Section>

        <Section id="roadmap" index="07" title="Where it goes next">
          <ol className="divide-y divide-rule">
            {ROADMAP.map((r, i) => (
              <li key={r.step} className="grid grid-cols-[3rem_14rem_minmax(0,1fr)_auto] items-baseline gap-x-3 px-6 py-2.5">
                <span className="font-mono text-meta text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                <span className={`text-body font-medium ${r.done ? 'text-ink' : 'text-ink-2'}`}>{r.step}</span>
                <span className={`text-body ${r.done ? 'text-ink-2' : 'text-ink-3'}`}>{r.detail}</span>
                <span className={`text-meta ${r.done ? 'text-ok' : 'text-ink-3'}`}>{r.done ? 'Shipped' : 'Planned'}</span>
              </li>
            ))}
          </ol>
        </Section>

        <section aria-label="Get started" className="flex items-center justify-between gap-6 rounded-md bg-shell px-8 py-6 text-shell-ink">
          <p className="wide text-title font-semibold">Release decisions should rest on evidence, not on how sure the agent sounds.</p>
          <div className="flex shrink-0 items-center gap-4">
            <span className="text-meta text-shell-muted">Use About in the header to come back here.</span>
            <button type="button" className="btn-primary px-4 py-2.5 text-lead" onClick={open}>
              Open the benchmark
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>
    </>
  )
}
