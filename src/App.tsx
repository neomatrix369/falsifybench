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
import { StageTrace } from './components/StageTrace'
import { DEFAULT_BENCHMARK_ID, syntheticScenarioSource } from './data/scenarioSource'
import { scriptedAgentRunner } from './data/scriptedAgentRunner'
import { liveAgentRunner } from './data/liveAgentRunner'
import { liveAvailable, type LiveHealth } from './domain/live'
import { runRecovery } from './domain/recovery'
import { isRunnableProvenance, PARTNER_UNAVAILABLE_REASON } from './domain/provenance'
import { randomRunId, systemClock } from './domain/receipt'
import { buildRunLog, type RunLogEntry } from './domain/runLog'
import { AUDIT_STAGE_INDEX, LAST_STAGE_INDEX } from './domain/stages'
import type { AgentRunner, Grader, Scenario, ScenarioSource } from './domain/types'
import { useWalkthrough, type AgentSeams, type WalkthroughDeps } from './hooks/useWalkthrough'

const DEFAULT_DEPS: WalkthroughDeps = { clock: systemClock, createRunId: randomRunId }

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
}

function Bench({ scenario, deps, seams, onSelectBenchmark, focusScenarioOnMount, carried, onSwitchView, agentMode, health, onSelectAgentMode }: BenchProps) {
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

  useEffect(() => {
    if (focusScenarioOnMount) activeScenarioHeading.current?.focus()
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
    if (state.reached === LAST_STAGE_INDEX) select(LAST_STAGE_INDEX)
  }, [select, state.reached])

  return (
    <>
      <Header
        onReceiptAnchor={openReceipt}
        onSwitchView={onSwitchView}
        agent={{
          mode: agentMode,
          health,
          onSelect: (mode) => {
            if (mode !== agentMode) onSelectAgentMode(mode, actions.abandon(`switched agent to ${mode === 'live' ? 'live baseline' : 'scripted fixture'}`))
          },
        }}
      />
      <main className="mx-auto grid max-w-page grid-cols-[minmax(360px,35fr)_minmax(0,65fr)] items-start gap-6 px-6 py-6">
        <div className="space-y-4">
          <BenchmarkPicker
            activeId={scenario.id}
            onSelect={(id) => onSelectBenchmark(id, id === scenario.id ? null : actions.abandon(`switched to ${id}`))}
          />
          <ScenarioCard
            ref={activeScenarioHeading}
            scenario={scenario}
            baselineLabel={live ? `Baseline agent (live: ${live.model})` : undefined}
            excludedIds={excludedIds} excludedReason={excludedReason} canRun={controls.canRun} onRun={run} />
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
}: {
  initialId?: string
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
    probeLive().then((h) => {
      if (!cancelled) setHealth(h)
    })
    return () => {
      cancelled = true
    }
  }, [probeLive])
  const mode: AgentMode = agentMode === 'live' && liveAvailable(health) ? 'live' : 'scripted'
  const seams = useMemo(() => ({ runner: mode === 'live' ? liveRunner : runner, grader }), [mode, liveRunner, runner, grader])
  const selectAgentMode = useCallback((next: AgentMode, abandoned: RunLogEntry | null) => {
    setCarried(abandoned)
    setAgentMode(next)
  }, [])
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
      />
    </WalkthroughErrorBoundary>
  )
}
