import { useCallback, useEffect, useRef, useState } from 'react'
import { BenchmarkPicker } from './components/BenchmarkPicker'
import { ComingNextCards } from './components/ComingNextCards'
import { UnavailableModesNote } from './components/DataModeSelector'
import { ErrorCard, WalkthroughErrorBoundary } from './components/ErrorCard'
import { Header, type View } from './components/Header'
import { RunLog } from './components/RunLog'
import { ReceiptSummary } from './components/ReceiptSummary'
import { ResultSurface } from './components/ResultSurface'
import { ScenarioCard } from './components/ScenarioCard'
import { StageTrace } from './components/StageTrace'
import { MAT_001_ID } from './data/mat001'
import { syntheticScenarioSource } from './data/scenarioSource'
import { unsealRecovery } from './domain/evaluationCheck'
import { isRunnableProvenance, PARTNER_UNAVAILABLE_REASON } from './domain/provenance'
import { randomRunId, systemClock } from './domain/receipt'
import { buildRunLog, type RunLogEntry } from './domain/runLog'
import { AUDIT_STAGE_INDEX, LAST_STAGE_INDEX } from './domain/stages'
import type { Scenario, ScenarioSource } from './domain/types'
import { useWalkthrough, type WalkthroughDeps } from './hooks/useWalkthrough'

const DEFAULT_DEPS: WalkthroughDeps = { clock: systemClock, createRunId: randomRunId }

interface BenchProps {
  scenario: Scenario
  deps: WalkthroughDeps
  onSelectBenchmark: (id: string, abandoned?: RunLogEntry | null) => void
  focusScenarioOnMount: boolean
  carried: RunLogEntry | null
  onSwitchView?: (view: View) => void
}

function Bench({ scenario, deps, onSelectBenchmark, focusScenarioOnMount, carried, onSwitchView }: BenchProps) {
  const { state, evaluation, receipt, error, controls, actions, unseal, abandoned } = useWalkthrough(scenario, deps, carried)
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

  const excludedIds =
    state.reached >= AUDIT_STAGE_INDEX && evaluation ? (evaluation.hiddenTruth.untrustedEvidenceIds ?? []) : []

  const openReceipt = useCallback(() => {
    if (state.reached === LAST_STAGE_INDEX) select(LAST_STAGE_INDEX)
  }, [select, state.reached])

  return (
    <>
      <Header onReceiptAnchor={openReceipt} onSwitchView={onSwitchView} />
      <main className="mx-auto grid max-w-page grid-cols-[minmax(360px,35fr)_minmax(0,65fr)] items-start gap-6 px-6 py-6">
        <div className="space-y-4">
          <BenchmarkPicker
            activeId={scenario.id}
            onSelect={(id) => onSelectBenchmark(id, id === scenario.id ? null : actions.abandon(`switched to ${id}`))}
          />
          <ScenarioCard ref={activeScenarioHeading} scenario={scenario} excludedIds={excludedIds} canRun={controls.canRun} onRun={run} />
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
            entries={buildRunLog({ state, scenario, evaluation, receipt, unseal, error, abandoned })}
            state={state}
            unsealing={controls.nextPending}
            failure={error ? unsealRecovery(error) : null}
          />
          <ComingNextCards activeId={scenario.id} onReturnToActive={() => activeScenarioHeading.current?.focus()} />
          <UnavailableModesNote />
        </div>
        <div className="space-y-4">
          <WalkthroughErrorBoundary onReset={actions.reset} resetKey={state.runId}>
            {error ? (
              <ErrorCard message={error.message} onReset={actions.reset} recovery={unsealRecovery(error)} />
            ) : (
              <ResultSurface
                ref={resultHeading}
                state={state}
                scenario={scenario}
                evaluation={evaluation}
                receipt={receipt}
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
  onSwitchView,
}: {
  source?: ScenarioSource
  deps?: WalkthroughDeps
  onSwitchView?: (view: View) => void
}) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState(MAT_001_ID)
  const [switched, setSwitched] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [carried, setCarried] = useState<RunLogEntry | null>(null)
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
            if (activeId === MAT_001_ID) window.location.reload()
            else setActiveId(MAT_001_ID)
          }}
        />
      </div>
    )
  }
  if (!scenario) return <p className="p-10 text-body text-ink-3">Loading {activeId}…</p>
  return (
    <WalkthroughErrorBoundary onReset={() => setAttempt((n) => n + 1)} resetKey={attempt}>
      <Bench
        key={`${scenario.id}:${attempt}`}
        scenario={scenario}
        deps={deps}
        onSelectBenchmark={selectBenchmark}
        focusScenarioOnMount={switched}
        carried={carried}
        onSwitchView={onSwitchView}
      />
    </WalkthroughErrorBoundary>
  )
}
