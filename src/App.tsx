import { useCallback, useEffect, useRef, useState } from 'react'
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

function Bench({ scenario, deps }: { scenario: Scenario; deps: WalkthroughDeps }) {
  const { state, evaluation, receipt, error, controls, actions } = useWalkthrough(scenario, deps)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const activeScenarioHeading = useRef<HTMLHeadingElement>(null)
  const [focusRequest, setFocusRequest] = useState(0)

  useEffect(() => {
    if (focusRequest > 0) resultHeading.current?.focus()
  }, [focusRequest])

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

  // Keep keyboard focus off <body> when the pressed control disables itself.
  const next = useCallback(() => {
    actions.next()
    if (state.cursor === LAST_STAGE_INDEX - 1) setFocusRequest((n) => n + 1)
  }, [actions, state.cursor])

  const back = useCallback(() => {
    actions.back()
    if (state.cursor === 1) setFocusRequest((n) => n + 1)
  }, [actions, state.cursor])

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
          <ScenarioCard ref={activeScenarioHeading} scenario={scenario} canRun={controls.canRun} onRun={run} />
          <StageTrace
            state={state}
            controls={controls}
            onSelect={select}
            onBack={back}
            onNext={next}
            onToggleAutoplay={actions.toggleAutoplay}
            onReset={reset}
          />
          <ComingNextCards onReturnToActive={() => activeScenarioHeading.current?.focus()} />
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

  useEffect(() => {
    let cancelled = false
    setScenario(null)
    setLoadError(null)
    source.loadScenario(MAT_001_ID).then(
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
  }, [source])

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <ErrorCard message={loadError} onReset={() => window.location.reload()} />
      </div>
    )
  }
  if (!scenario) return <p className="p-10 text-body text-ink-3">Loading MAT-001…</p>
  return <Bench scenario={scenario} deps={deps} />
}
