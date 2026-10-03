import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { AUDIT_STAGE_INDEX, LAST_STAGE_INDEX } from '../domain/stages'
import { createReceipt, type BenchmarkReceipt, type Clock, type RunIdFactory } from '../domain/receipt'
import { evaluationProblems, InvalidEvaluationError } from '../domain/evaluationCheck'
import type { UnsealTiming } from '../domain/runLog'
import { UNSEAL_TIMEOUT_MS, UnsealTimeoutError, withTimeout } from '../domain/unsealTimeout'
import { controlAvailability, initialWalkthroughState, walkthroughReducer, type ControlAvailability } from '../domain/walkthrough'
import type { Scenario, ScenarioEvaluation } from '../domain/types'

export const AUTOPLAY_INTERVAL_MS = 3000

export interface WalkthroughDeps {
  clock: Clock
  createRunId: RunIdFactory
}

/** `nextPending`: Next step is held (not disabled) while the sealed evaluation loads, so it keeps focus. */
export type WalkthroughControls = ControlAvailability & { nextPending: boolean }

export function useWalkthrough(scenario: Scenario, deps: WalkthroughDeps) {
  const [state, dispatch] = useReducer(walkthroughReducer, initialWalkthroughState)
  const [evaluation, setEvaluation] = useState<ScenarioEvaluation | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [unseal, setUnseal] = useState<UnsealTiming | null>(null)
  const { clock, createRunId } = deps
  const now = useCallback(() => clock().toISOString(), [clock])

  const needsEvaluation = state.reached >= AUDIT_STAGE_INDEX
  useEffect(() => {
    if (!needsEvaluation || evaluation) return
    let cancelled = false
    const requested = clock()
    setUnseal({ requestedAt: requested.toISOString() })
    withTimeout(scenario.evaluation.unseal(), UNSEAL_TIMEOUT_MS, () => new UnsealTimeoutError(scenario.id, UNSEAL_TIMEOUT_MS))
      .then((value) => {
        if (cancelled) return
        const problems = evaluationProblems(scenario, value)
        if (problems.length) throw new InvalidEvaluationError(scenario.id, problems)
        const loaded = clock()
        setUnseal({ requestedAt: requested.toISOString(), loadedAt: loaded.toISOString(), ms: loaded.getTime() - requested.getTime() })
        setEvaluation(value)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        dispatch({ type: 'AUTOPLAY_OFF' })
      })
    return () => {
      cancelled = true
    }
  }, [needsEvaluation, evaluation, scenario, clock])

  const awaitingEvaluation = state.cursor === state.reached && needsEvaluation && !evaluation
  const blocked = awaitingEvaluation || error !== null

  useEffect(() => {
    if (!state.autoplay || blocked) return
    const timer = window.setTimeout(() => dispatch({ type: 'NEXT', source: 'auto', at: now() }), AUTOPLAY_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [state.autoplay, state.cursor, blocked, now])

  const receipt: BenchmarkReceipt | null = useMemo(() => {
    if (state.reached < LAST_STAGE_INDEX || !evaluation || !state.runId || !state.startedAt) return null
    return createReceipt({
      scenario,
      evaluation,
      runId: state.runId,
      startedAt: state.startedAt,
      events: state.events,
      mode: 'synthetic',
      clock,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reached, state.runId, evaluation, scenario])

  const actions = useMemo(
    () => ({
      run: () => dispatch({ type: 'START', runId: createRunId(), at: now() }),
      next: () => {
        if (!blocked) dispatch({ type: 'NEXT', source: 'manual', at: now() })
        else if (state.autoplay) dispatch({ type: 'AUTOPLAY_OFF' })
      },
      back: () => dispatch({ type: 'BACK' }),
      select: (index: number) => dispatch({ type: 'SELECT', index }),
      toggleAutoplay: () =>
        state.autoplay
          ? dispatch({ type: 'AUTOPLAY_OFF' })
          : dispatch({ type: 'AUTOPLAY_ON', runId: createRunId(), at: now() }),
      reset: () => {
        setError(null)
        dispatch({ type: 'RESET' })
      },
    }),
    [createRunId, now, state.autoplay, blocked],
  )

  const base = controlAvailability(state)
  const controls: WalkthroughControls = {
    ...base,
    canNext: base.canNext && !blocked,
    canAutoplay: base.canAutoplay && error === null,
    nextPending: base.canNext && awaitingEvaluation && error === null,
  }
  return { state, evaluation, receipt, error, controls, actions, unseal }
}
