import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { AUDIT_STAGE_INDEX, LAST_STAGE_INDEX } from '../domain/stages'
import { createReceipt, type BenchmarkReceipt, type Clock, type RunIdFactory } from '../domain/receipt'
import { evaluationProblems, InvalidEvaluationError } from '../domain/evaluationCheck'
import { abandonedEntry, type RunLogEntry, type UnsealTiming } from '../domain/runLog'
import { UNSEAL_TIMEOUT_MS, UnsealTimeoutError, withTimeout } from '../domain/unsealTimeout'
import { controlAvailability, initialWalkthroughState, walkthroughReducer, type ControlAvailability } from '../domain/walkthrough'
import { gradeRun, runAgents } from '../domain/agentRun'
import type { AgentRunner, GradedRun, Grader, Scenario, ScenarioEvaluation } from '../domain/types'

export const AUTOPLAY_INTERVAL_MS = 3000

export interface WalkthroughDeps {
  clock: Clock
  createRunId: RunIdFactory
}

/** Who answers and who grades. `grader` defaults to `fixtureGrader`, imported with the sealed evaluation so its hand scores stay out of the main bundle. */
export interface AgentSeams {
  runner: AgentRunner
  grader?: Grader
}

const loadFixtureGrader = () => import('../domain/fixtureGrader').then((m) => m.fixtureGrader)

interface Unsealed {
  evaluation: ScenarioEvaluation
  run: GradedRun
}

/** `nextPending`: Next step is held (not disabled) while the sealed evaluation loads, so it keeps focus. */
export type WalkthroughControls = ControlAvailability & { nextPending: boolean }

export function useWalkthrough(scenario: Scenario, deps: WalkthroughDeps, seams: AgentSeams, carried: RunLogEntry | null = null) {
  const [abandoned, setAbandoned] = useState<RunLogEntry | null>(carried)
  const [state, dispatch] = useReducer(walkthroughReducer, initialWalkthroughState)
  const [unsealed, setUnsealed] = useState<Unsealed | null>(null)
  const evaluation = unsealed?.evaluation ?? null
  const run = unsealed?.run ?? null
  const [error, setError] = useState<Error | null>(null)
  const [unseal, setUnseal] = useState<UnsealTiming | null>(null)
  const { clock, createRunId } = deps
  const { runner, grader } = seams
  const now = useCallback(() => clock().toISOString(), [clock])

  const needsEvaluation = state.reached >= AUDIT_STAGE_INDEX
  useEffect(() => {
    if (!needsEvaluation || unsealed) return
    let cancelled = false
    const requested = clock()
    setUnseal({ requestedAt: requested.toISOString() })
    const loading = Promise.all([scenario.evaluation.unseal(), runAgents(runner, scenario), grader ?? loadFixtureGrader()])
    withTimeout(loading, UNSEAL_TIMEOUT_MS, () => new UnsealTimeoutError(scenario.id, UNSEAL_TIMEOUT_MS))
      .then(([value, responses, grading]) => {
        if (cancelled) return
        const graded = gradeRun(grading, scenario, value, responses)
        const problems = evaluationProblems(scenario, value, graded)
        if (problems.length) throw new InvalidEvaluationError(scenario.id, problems)
        const loaded = clock()
        setUnseal({ requestedAt: requested.toISOString(), loadedAt: loaded.toISOString(), ms: loaded.getTime() - requested.getTime() })
        setUnsealed({ evaluation: value, run: graded })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        dispatch({ type: 'AUTOPLAY_OFF' })
      })
    return () => {
      cancelled = true
    }
  }, [needsEvaluation, unsealed, scenario, clock, runner, grader])

  const awaitingEvaluation = state.cursor === state.reached && needsEvaluation && !unsealed
  const blocked = awaitingEvaluation || error !== null

  useEffect(() => {
    if (!state.autoplay || blocked) return
    const timer = window.setTimeout(() => dispatch({ type: 'NEXT', source: 'auto', at: now() }), AUTOPLAY_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [state.autoplay, state.cursor, blocked, now])

  const receipt: BenchmarkReceipt | null = useMemo(() => {
    if (state.reached < LAST_STAGE_INDEX || !evaluation || !run || !state.runId || !state.startedAt) return null
    return createReceipt({
      scenario,
      evaluation,
      run,
      runId: state.runId,
      startedAt: state.startedAt,
      events: state.events,
      mode: 'synthetic',
      clock,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reached, state.runId, unsealed, scenario])

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
        setAbandoned(abandonedEntry(state, scenario, 'Reset', now()))
        setError(null)
        dispatch({ type: 'RESET' })
      },
      /** The Run log line for a run discarded by `cause`, or null if nothing is in progress. */
      abandon: (cause: string) => abandonedEntry(state, scenario, cause, now()),
    }),
    [createRunId, now, state, scenario, blocked],
  )

  const base = controlAvailability(state)
  const controls: WalkthroughControls = {
    ...base,
    canNext: base.canNext && !blocked,
    canAutoplay: base.canAutoplay && error === null,
    nextPending: base.canNext && awaitingEvaluation && error === null,
  }
  return { state, evaluation, run, receipt, error, controls, actions, unseal, abandoned }
}
