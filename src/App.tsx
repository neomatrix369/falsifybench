import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BenchmarkPicker } from './components/BenchmarkPicker'
import { ComingNextCards } from './components/ComingNextCards'
import { UnavailableModesNote, type AgentMode } from './components/DataModeSelector'
import { ErrorCard, WalkthroughErrorBoundary } from './components/ErrorCard'
import { Header, type View } from './components/Header'
import { RunLog } from './components/RunLog'
import { ReceiptSummary } from './components/ReceiptSummary'
import { ResultSurface } from './components/ResultSurface'
import { ScenarioCard } from './components/ScenarioCard'
import { SimpleJourney } from './components/SimpleJourney'
import { StageTrace } from './components/StageTrace'
import { DEFAULT_BENCHMARK_ID, syntheticScenarioSource } from './data/scenarioSource'
import { scriptedAgentRunner } from './data/scriptedAgentRunner'
import { liveAgentRunner } from './data/liveAgentRunner'
import { LIVE_HEALTH_RETRY_MS, liveAvailable, type LiveHealth } from './domain/live'
import { runRecovery } from './domain/recovery'
import { isRunnableProvenance, PARTNER_UNAVAILABLE_REASON } from './domain/provenance'
import { randomRunId, systemClock } from './domain/receipt'
import { buildRunLog, type RunLogEntry } from './domain/runLog'
import { AUDIT_STAGE_INDEX, LAST_STAGE_INDEX } from './domain/stages'
import type { AgentRunner, Grader, Scenario, ScenarioSource } from './domain/types'
import { useWalkthrough, type AgentSeams, type WalkthroughDeps } from './hooks/useWalkthrough'

const DEFAULT_DEPS: WalkthroughDeps = { clock: systemClock, createRunId: randomRunId }

export type BenchTab = 'simple' | 'detailed'

const TABS: { tab: BenchTab; label: string }[] = [
  { tab: 'simple', label: 'Simple' },
  { tab: 'detailed', label: 'Detailed' },
]

function TabBar({ tab, onChange }: { tab: BenchTab; onChange: (tab: BenchTab) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Benchmark view"
      className="mx-auto flex max-w-page gap-1 px-6 pt-4"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        const next = TABS[(TABS.findIndex((t) => t.tab === tab) + 1) % TABS.length].tab
        onChange(next)
        requestAnimationFrame(() => document.getElementById(`bench-tab-${next}`)?.focus())
      }}
    >
      {TABS.map((t) => {
        const selected = t.tab === tab
        return (
          <button
            key={t.tab}
            id={`bench-tab-${t.tab}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="bench-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.tab)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-body font-medium transition-colors duration-fast ${
              selected ? 'border-primary text-ink' : 'border-transparent text-ink-3 hover:border-rule-strong hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/** Scroll to a section after a tab switch has rendered it. */
function scrollToSection(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
}

interface BenchProps {
  scenario: Scenario
  deps: WalkthroughDeps
  seams: AgentSeams
  onSelectBenchmark: (id: string, abandoned?: RunLogEntry | null) => void
  focusScenarioOnMount: boolean
  carried: RunLogEntry | null
  onSwitchView?: (view: View) => void
  agentMode: AgentMode
  health: LiveHealth | null
  onSelectAgentMode: (mode: AgentMode, abandoned: RunLogEntry | null) => void
  tab: BenchTab
  onTabChange: (tab: BenchTab) => void
}

function Bench({ scenario, deps, seams, onSelectBenchmark, focusScenarioOnMount, carried, onSwitchView, agentMode, health, onSelectAgentMode, tab, onTabChange }: BenchProps) {
  const { state, evaluation, run: graded, receipt, error, controls, actions, unseal, abandoned, liveCall, awaitingLive } = useWalkthrough(
    scenario,
    deps,
    seams,
    carried,
  )
  const live = seams.runner.execution === 'live' ? { model: health?.model ?? 'configured model', call: liveCall } : null
  const recovery = error ? runRecovery(error) : null
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const activeScenarioHeading = useRef<HTMLHeadingElement>(null)
  const [focusRequest, setFocusRequest] = useState(0)

  useEffect(() => {
    if (focusRequest > 0) resultHeading.current?.focus()
  }, [focusRequest])

  const mountTab = useRef(tab)
  useEffect(() => {
    if (focusScenarioOnMount) (mountTab.current === 'simple' ? resultHeading : activeScenarioHeading).current?.focus()
  }, [focusScenarioOnMount])

  const select = useCallback(
    (index: number) => {
      actions.select(index)
      setFocusRequest((n) => n + 1)
    },
    [actions],
  )

  const run = useCallback(() => {
    actions.run()
    setFocusRequest((n) => n + 1)
  }, [actions])

  // Back / Next step keep focus while stepping. Only when the focused control
  // disables itself (Back at Evidence, Next step at Receipt) does focus move to the stage heading.
  const stepControls = useRef({ canNext: controls.canNext, canBack: controls.canBack })
  useEffect(() => {
    const prev = stepControls.current
    stepControls.current = { canNext: controls.canNext, canBack: controls.canBack }
    const disabled = (prev.canNext && !controls.canNext) || (prev.canBack && !controls.canBack)
    const active = document.activeElement
    const stranded = active === null || active === document.body || (active as HTMLButtonElement).disabled === true
    if (disabled && stranded) setFocusRequest((n) => n + 1)
  }, [controls.canNext, controls.canBack])

  const reset = useCallback(() => {
    actions.reset()
    setFocusRequest((n) => n + 1)
  }, [actions])

  const unsealed = state.reached >= AUDIT_STAGE_INDEX && evaluation ? evaluation : null
  const excludedIds = unsealed?.hiddenTruth.untrustedEvidenceIds ?? []
  const excludedReason = unsealed?.hiddenTruth.untrustedReason

  const openReceipt = useCallback(() => {
    onTabChange('detailed')
    if (state.reached === LAST_STAGE_INDEX) select(LAST_STAGE_INDEX)
    scrollToSection('current-receipt')
  }, [select, state.reached, onTabChange])

  const openPreviews = useCallback(() => {
    onTabChange('detailed')
    scrollToSection('scenario-previews')
  }, [onTabChange])

  const openDetail = useCallback(
    (index: number) => {
      onTabChange('detailed')
      select(index)
    },
    [select, onTabChange],
  )

  const switchBenchmark = (id: string) => onSelectBenchmark(id, id === scenario.id ? null : actions.abandon(`switched to ${id}`))

  return (
    <>
      <Header
        onReceiptAnchor={openReceipt}
        onPreviewsAnchor={openPreviews}
        onSwitchView={onSwitchView}
        agent={{
          mode: agentMode,
          health,
          onSelect: (mode) => {
            if (mode !== agentMode) onSelectAgentMode(mode, actions.abandon(`switched agent to ${mode === 'live' ? 'live baseline' : 'scripted fixture'}`))
          },
        }}
      />
      <TabBar tab={tab} onChange={onTabChange} />
      {tab === 'simple' ? (
        <main id="bench-panel" role="tabpanel" aria-labelledby="bench-tab-simple" className="mx-auto max-w-page px-6 py-4">
          <WalkthroughErrorBoundary onReset={actions.reset} resetKey={state.runId}>
            {error ? (
              <ErrorCard message={error.message} onReset={actions.reset} recovery={recovery ?? 'reset'} onRetry={actions.retryLive} />
            ) : (
              <SimpleJourney
                ref={resultHeading}
                scenario={scenario}
                evaluation={evaluation}
                run={graded}
                receipt={receipt}
                live={live}
                state={state}
                controls={controls}
                onSelectBenchmark={switchBenchmark}
                onRun={run}
                onBack={actions.back}
                onNext={actions.next}
                onToggleAutoplay={actions.toggleAutoplay}
                onReset={reset}
                onSelect={actions.select}
                onOpenDetail={openDetail}
              />
            )}
          </WalkthroughErrorBoundary>
        </main>
      ) : (
        <main id="bench-panel" role="tabpanel" aria-labelledby="bench-tab-detailed" className="mx-auto grid max-w-page grid-cols-[minmax(360px,35fr)_minmax(0,65fr)] items-start gap-6 px-6 py-6">
          <div className="space-y-4">
            <BenchmarkPicker activeId={scenario.id} onSelect={switchBenchmark} />
            <ScenarioCard
              ref={activeScenarioHeading}
              scenario={scenario}
              baselineLabel={live ? `Baseline agent (live: ${live.model})` : undefined}
              excludedIds={excludedIds}
              excludedReason={excludedReason}
              canRun={controls.canRun}
              onRun={run}
            />
            <StageTrace
              state={state}
              controls={controls}
              onSelect={select}
              onBack={actions.back}
              onNext={actions.next}
              onToggleAutoplay={actions.toggleAutoplay}
              onReset={reset}
            />
            <RunLog
              entries={buildRunLog({ state, scenario, evaluation, run: graded, receipt, unseal, error, abandoned, live })}
              state={state}
              unsealing={controls.nextPending}
              awaitingLive={awaitingLive}
              failure={recovery}
            />
            <ComingNextCards activeId={scenario.id} onReturnToActive={() => activeScenarioHeading.current?.focus()} />
            <UnavailableModesNote health={health} />
          </div>
          <div className="space-y-4">
            <WalkthroughErrorBoundary onReset={actions.reset} resetKey={state.runId}>
              {error ? (
                <ErrorCard message={error.message} onReset={actions.reset} recovery={recovery ?? 'reset'} onRetry={actions.retryLive} />
              ) : (
                <ResultSurface
                  ref={resultHeading}
                  state={state}
                  scenario={scenario}
                  evaluation={evaluation}
                  run={graded}
                  receipt={receipt}
                  live={live}
                  onSelect={select}
                  onSelectTab={actions.select}
                />
              )}
              <ReceiptSummary receipt={receipt} onOpen={openReceipt} />
            </WalkthroughErrorBoundary>
          </div>
        </main>
      )}
    </>
  )
}

export default function App({
  source = syntheticScenarioSource,
  deps = DEFAULT_DEPS,
  runner = scriptedAgentRunner,
  liveRunner = liveAgentRunner,
  probeLive = null,
  grader,
  onSwitchView,
  initialId = DEFAULT_BENCHMARK_ID,
  initialTab = 'detailed',
  onTabChange,
}: {
  initialId?: string
  /** Root opens on Simple; direct mounts (tests) default to Detailed. */
  initialTab?: BenchTab
  onTabChange?: (tab: BenchTab) => void
  source?: ScenarioSource
  deps?: WalkthroughDeps
  runner?: AgentRunner
  /** Used when the Agent selector is on Live; enabled only when `probeLive` reports a configured local server. */
  liveRunner?: AgentRunner
  /** Asks the local server whether live mode is configured. Null (the default, and always on the deployed build) keeps Live unavailable. */
  probeLive?: (() => Promise<LiveHealth | null>) | null
  /** Defaults to `fixtureGrader` for scripted runs and the rule grader for live runs, loaded at Audit with the sealed evaluation. */
  grader?: Grader
  onSwitchView?: (view: View) => void
}) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState(initialId)
  const [switched, setSwitched] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [carried, setCarried] = useState<RunLogEntry | null>(null)
  const [health, setHealth] = useState<LiveHealth | null>(null)
  const [agentMode, setAgentMode] = useState<AgentMode>('scripted')
  useEffect(() => {
    if (!probeLive) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const probe = () => {
      probeLive().then((h) => {
        if (cancelled) return
        setHealth(h)
        if (h === null) timer = setTimeout(probe, LIVE_HEALTH_RETRY_MS)
      })
    }
    probe()
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [probeLive])
  const mode: AgentMode = agentMode === 'live' && liveAvailable(health) ? 'live' : 'scripted'
  const seams = useMemo(() => ({ runner: mode === 'live' ? liveRunner : runner, grader }), [mode, liveRunner, runner, grader])
  const selectAgentMode = useCallback((next: AgentMode, abandoned: RunLogEntry | null) => {
    setCarried(abandoned)
    setAgentMode(next)
  }, [])
  const [tab, setTab] = useState<BenchTab>(initialTab)
  const changeTab = useCallback(
    (next: BenchTab) => {
      setTab(next)
      onTabChange?.(next)
    },
    [onTabChange],
  )
  const selectBenchmark = useCallback((id: string, abandoned: RunLogEntry | null = null) => {
    setCarried(abandoned)
    setSwitched(true)
    setActiveId(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setScenario(null)
    setLoadError(null)
    source.loadScenario(activeId).then(
      (loaded) => {
        if (cancelled) return
        if (isRunnableProvenance(loaded.provenance)) setScenario(loaded)
        else setLoadError(`${loaded.id} is not runnable: ${PARTNER_UNAVAILABLE_REASON}`)
      },
      (err: unknown) => {
        if (!cancelled) setLoadError(String(err))
      },
    )
    return () => {
      cancelled = true
    }
  }, [source, activeId])

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <ErrorCard
          message={loadError}
          onReset={() => {
            if (activeId === initialId) window.location.reload()
            else setActiveId(initialId)
          }}
        />
      </div>
    )
  }
  if (!scenario) return <p className="p-10 text-body text-ink-3">Loading {activeId}…</p>
  return (
    <WalkthroughErrorBoundary onReset={() => setAttempt((n) => n + 1)} resetKey={attempt}>
      <Bench
        key={`${scenario.id}:${attempt}:${mode}`}
        scenario={scenario}
        deps={deps}
        seams={seams}
        onSelectBenchmark={selectBenchmark}
        focusScenarioOnMount={switched}
        carried={carried}
        onSwitchView={onSwitchView}
        agentMode={mode}
        health={health}
        onSelectAgentMode={selectAgentMode}
        tab={tab}
        onTabChange={changeTab}
      />
    </WalkthroughErrorBoundary>
  )
}
