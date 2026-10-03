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

const isText = (v: unknown) => typeof v === 'string' && v.trim() !== ''
const isTextList = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(isText)

/** Fields the walkthrough renders after Audit; a missing one would crash a panel mid-run. */
function shapeProblems(e: ScenarioEvaluation): string[] {
  const g = (e?.guarded ?? {}) as unknown as Partial<Record<string, unknown>>
  const n = (e?.narrative ?? {}) as unknown as Partial<Record<string, unknown>>
  const fields: [string, unknown, (v: unknown) => boolean][] = [
    ['hiddenTruth.summary', e?.hiddenTruth?.summary, isText],
    ['sufficientNextAction', e?.sufficientNextAction, isText],
    ...(['agentLabel', 'verdict', 'confidenceLabel', 'claim', 'nextAction'] as const).map(
      (k): [string, unknown, (v: unknown) => boolean] => [`guarded.${k}`, g[k], isText],
    ),
    ['guarded.rationale', g.rationale, isTextList],
    ...(['auditHeadline', 'auditQuestion', 'auditAnswer', 'guardedHeadline', 'guardedIntro', 'guardedWhy'] as const).map(
      (k): [string, unknown, (v: unknown) => boolean] => [`narrative.${k}`, n[k], isText],
    ),
  ]
  return fields.filter(([, value, ok]) => !ok(value)).map(([name]) => `Malformed evaluation: ${name} is missing or empty`)
}

/** Why an unsealed evaluation can't be used; empty when it passes every runtime gate. */
export function evaluationProblems(scenario: Scenario, evaluation: ScenarioEvaluation): string[] {
  const shape = shapeProblems(evaluation)
  if (shape.length) return shape
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
