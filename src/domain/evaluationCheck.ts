import { integrityChecks } from './benchmarkScore'
import type { Scenario, ScenarioEvaluation } from './types'

/** Data gates (see benchmarkScore.ts) that apply to one unsealed evaluation at runtime. */
const RUNTIME_GATES = ['I3', 'I4', 'I5', 'I6', 'I7', 'I8']

export class InvalidEvaluationError extends Error {
  readonly problems: string[]
  constructor(scenarioId: string, problems: string[]) {
    super(`The sealed evaluation for ${scenarioId} failed its data checks: ${problems.join('; ')}`)
    this.name = 'InvalidEvaluationError'
    this.problems = problems
  }
}

/** Why an unsealed evaluation can't be used; empty when it passes every runtime gate. */
export function evaluationProblems(scenario: Scenario, evaluation: ScenarioEvaluation): string[] {
  try {
    return integrityChecks({ scenario, evaluation }, [scenario.id])
      .filter((c) => RUNTIME_GATES.includes(c.id) && !c.ok)
      .map((c) => `${c.id} ${c.label}: ${c.detail}`)
  } catch (err) {
    return [`Malformed evaluation: ${err instanceof Error ? err.message : String(err)}`]
  }
}

/** How a failed unseal can be recovered: a reload retries a failed import; bad data fails again whatever the user does. */
export type UnsealRecovery = 'reload' | 'fix-data'

export function unsealRecovery(error: Error): UnsealRecovery {
  return error instanceof InvalidEvaluationError ? 'fix-data' : 'reload'
}
