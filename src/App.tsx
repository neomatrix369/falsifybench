import { useCallback, useEffect, useRef, useState } from 'react'
import { BenchmarkPicker } from './components/BenchmarkPicker'
import { ComingNextCards } from './components/ComingNextCards'
import { UnavailableModesNote } from './components/DataModeSelector'
import { ErrorCard, WalkthroughErrorBoundary } from './components/ErrorCard'
import { Header } from './components/Header'
import { ReceiptSummary } from './components/ReceiptSummary'
import { ResultSurface } from './components/ResultSurface'
import { ScenarioCard } from './components/ScenarioCard'
import { StageTrace } from './components/StageTrace'
import { MAT_001_ID } from './data/mat001'
import { syntheticScenarioSource } from './data/scenarioSource'
import { isRunnableProvenance, PARTNER_UNAVAILABLE_REASON } from './domain/provenance'
import { randomRunId, systemClock } from './domain/receipt'
import { LAST_STAGE_INDEX } from './domain/stages'
import type { Scenario, ScenarioSource } from './domain/types'
import { useWalkthrough, type WalkthroughDeps } from './hooks/useWalkthrough'

const DEFAULT_DEPS: WalkthroughDeps = { clock: systemClock, createRunId: randomRunId }

interface BenchProps {
  scenario: Scenario
  deps: WalkthroughDeps
  onSelectBenchmark: (id: string) => void
  focusScenarioOnMount: boolean
}

function Bench({ scenario, deps, onSelectBenchmark, focusScenarioOnMount }: BenchProps) {
  const { state, evaluation, receipt, error, controls, actions } = useWalkthrough(scenario, deps)
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

  // Keep keyboard focus off <body> when the focused control disables itself,
  // including Next step while the sealed evaluation loads.
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

  const openReceipt = useCallback(() => {
    if (state.reached === LAST_STAGE_INDEX) select(LAST_STAGE_INDEX)
  }, [select, state.reached])

  return (
    <>
      <Header onReceiptAnchor={openReceipt} />
      <main className="mx-auto grid max-w-page grid-cols-[minmax(360px,35fr)_minmax(0,65fr)] items-start gap-6 px-6 py-6">
        <div className="space-y-4">
          <BenchmarkPicker activeId={scenario.id} onSelect={onSelectBenchmark} />
          <ScenarioCard ref={activeScenarioHeading} scenario={scenario} canRun={controls.canRun} onRun={run} />
          <StageTrace
            state={state}
            controls={controls}
            onSelect={select}
            onBack={actions.back}
            onNext={actions.next}
            onToggleAutoplay={actions.toggleAutoplay}
            onReset={reset}
          />
          <ComingNextCards activeId={scenario.id} onReturnToActive={() => activeScenarioHeading.current?.focus()} />
          <UnavailableModesNote />
        </div>
        <div className="space-y-4">
          <WalkthroughErrorBoundary onReset={actions.reset} resetKey={state.runId}>
            {error ? (
              <ErrorCard message={error.message} onReset={actions.reset} />
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
}: {
  source?: ScenarioSource
  deps?: WalkthroughDeps
}) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState(MAT_001_ID)
  const [switched, setSwitched] = useState(false)
  const selectBenchmark = useCallback((id: string) => {
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
        <ErrorCard message={loadError} onReset={() => window.location.reload()} />
      </div>
    )
  }
  if (!scenario) return <p className="p-10 text-body text-ink-3">Loading {activeId}…</p>
  return (
    <Bench
      key={scenario.id}
      scenario={scenario}
      deps={deps}
      onSelectBenchmark={selectBenchmark}
      focusScenarioOnMount={switched}
    />
  )
}
