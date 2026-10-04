import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { AUDIT_STAGE_INDEX, LAST_STAGE_INDEX, STAGES } from '../domain/stages'
import { createReceipt, type BenchmarkReceipt, type Clock, type RunIdFactory } from '../domain/receipt'
import { evaluationProblems, InvalidEvaluationError } from '../domain/evaluationCheck'
import { abandonedEntry, type RunLogEntry, type UnsealTiming } from '../domain/runLog'
import { UNSEAL_TIMEOUT_MS, UnsealTimeoutError, withTimeout } from '../domain/unsealTimeout'
import { controlAvailability, initialWalkthroughState, walkthroughReducer, type ControlAvailability } from '../domain/walkthrough'
import { gradeRun, runAgents } from '../domain/agentRun'
import { LIVE_BASELINE_TIMEOUT_MS, LiveAgentError, type LiveBaselineCall } from '../domain/live'
import type { AgentPath, AgentResponse, AgentRunner, GradedRun, Grader, Scenario, ScenarioEvaluation } from '../domain/types'

export const AUTOPLAY_INTERVAL_MS = 3000

export interface WalkthroughDeps {
  clock: Clock
  createRunId: RunIdFactory
}

/**
 * Who answers and who grades. `grader` defaults to `fixtureGrader` for scripted runners and to the rule grader for live
 * ones; both are imported with the sealed evaluation so grading code and hand scores stay out of the main bundle.
 */
export interface AgentSeams {
  runner: AgentRunner
  grader?: Grader
}

const loadFixtureGrader = () => import('../domain/fixtureGrader').then((m) => m.fixtureGrader)
const loadRuleGrader = () => import('../domain/ruleGraderSeam').then((m) => m.ruleGraderSeam)

const BASELINE_STAGE_INDEX = STAGES.indexOf('baseline')

interface Unsealed {
  evaluation: ScenarioEvaluation
  run: GradedRun
  /** Live runs grade a fresh baseline answer, so their graded run belongs to one run ID. */
  liveRunId: string | null
}

function asError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}

/** `nextPending`: Next step is held (not disabled) while the live baseline or the sealed evaluation loads, so it keeps focus. */
export type WalkthroughControls = ControlAvailability & { nextPending: boolean }

export function useWalkthrough(scenario: Scenario, deps: WalkthroughDeps, seams: AgentSeams, carried: RunLogEntry | null = null) {
  const [abandoned, setAbandoned] = useState<RunLogEntry | null>(carried)
  const [state, dispatch] = useReducer(walkthroughReducer, initialWalkthroughState)
  const [stored, setUnsealed] = useState<Unsealed | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [unseal, setUnseal] = useState<UnsealTiming | null>(null)
  const [liveCall, setLiveCall] = useState<LiveBaselineCall | null>(null)
  const [liveAttempt, setLiveAttempt] = useState(1)
  const { clock, createRunId } = deps
  const { runner, grader } = seams
  const isLive = runner.execution === 'live'
  const now = useCallback(() => clock().toISOString(), [clock])
  const unsealed = stored && (!isLive || stored.liveRunId === state.runId) ? stored : null
  const evaluation = unsealed?.evaluation ?? null
  const run = unsealed?.run ?? null

  const runId = state.runId
  const call = liveCall && liveCall.runId === runId ? liveCall : null
  const liveBaseline: AgentResponse | null = call?.status === 'done' ? call.response : null
  const needsLiveBaseline = isLive && runId !== null && state.reached >= BASELINE_STAGE_INDEX
  useEffect(() => {
    if (!needsLiveBaseline || !runId) return
    let cancelled = false
    const attempt = liveAttempt
    const requestedAt = now()
    setLiveCall({ status: 'pending', runId, attempt, requestedAt })
    const timeout = () =>
      new LiveAgentError({ kind: 'timeout', message: `The live baseline for ${scenario.id} did not answer within ${LIVE_BASELINE_TIMEOUT_MS / 1000} s` })
    withTimeout(runner.run('baseline', scenario), LIVE_BASELINE_TIMEOUT_MS, timeout)
      .then((response) => {
        if (cancelled) return
        if (!response.live) throw new LiveAgentError({ kind: 'validation', message: 'The live runner returned an answer without live-call facts', problems: ['live: missing'] })
        setLiveCall({ status: 'done', runId, attempt, requestedAt, settledAt: now(), response })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const failure = asError(err)
        setLiveCall({ status: 'error', runId, attempt, requestedAt, settledAt: now(), error: failure })
        setError(failure)
        dispatch({ type: 'AUTOPLAY_OFF' })
      })
    return () => {
      cancelled = true
    }
  }, [needsLiveBaseline, runId, liveAttempt, scenario, runner, now])

  const needsEvaluation = state.reached >= AUDIT_STAGE_INDEX
  useEffect(() => {
    if (!needsEvaluation || unsealed || (isLive && !liveBaseline)) return
    let cancelled = false
    const requested = clock()
    setUnseal({ requestedAt: requested.toISOString() })
    const answers: Promise<Record<AgentPath, AgentResponse>> = liveBaseline
      ? runner.run('guarded', scenario).then((guarded) => ({ baseline: liveBaseline, guarded }))
      : runAgents(runner, scenario)
    const loading = Promise.all([scenario.evaluation.unseal(), answers, grader ?? (isLive ? loadRuleGrader() : loadFixtureGrader())])
    withTimeout(loading, UNSEAL_TIMEOUT_MS, () => new UnsealTimeoutError(scenario.id, UNSEAL_TIMEOUT_MS))
      .then(([value, responses, grading]) => {
        if (cancelled) return
        const graded = gradeRun(grading, scenario, value, responses)
        const problems = evaluationProblems(scenario, value, graded)
        if (problems.length) throw new InvalidEvaluationError(scenario.id, problems)
        const loaded = clock()
        setUnseal({ requestedAt: requested.toISOString(), loadedAt: loaded.toISOString(), ms: loaded.getTime() - requested.getTime() })
        setUnsealed({ evaluation: value, run: graded, liveRunId: isLive ? runId : null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(asError(err))
        dispatch({ type: 'AUTOPLAY_OFF' })
      })
    return () => {
      cancelled = true
    }
  }, [needsEvaluation, unsealed, scenario, clock, runner, grader, isLive, liveBaseline, runId])

  const atFrontier = state.cursor === state.reached
  const awaitingLive = atFrontier && needsLiveBaseline && !liveBaseline
  const awaitingEvaluation = atFrontier && needsEvaluation && !unsealed
  const blocked = awaitingLive || awaitingEvaluation || error !== null

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
        setLiveCall(null)
        dispatch({ type: 'RESET' })
      },
      /** After a failed live call: ask the model again for the same run. */
      retryLive: () => {
        setError(null)
        setLiveAttempt((n) => n + 1)
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
    nextPending: base.canNext && (awaitingLive || awaitingEvaluation) && error === null,
  }
  return { state, evaluation, run, receipt, error, controls, actions, unseal, abandoned, liveCall: isLive ? call : null, awaitingLive }
}
