import type { AgentPath, AgentResponse, AgentRunner, GradedRun, Grader, GraderIdentity, Scenario, ScenarioEvaluation } from './types'

/** Asks the runner for both agents' answers on one scenario. */
export async function runAgents(runner: AgentRunner, scenario: Scenario): Promise<Record<AgentPath, AgentResponse>> {
  const [baseline, guarded] = await Promise.all([runner.run('baseline', scenario), runner.run('guarded', scenario)])
  return { baseline, guarded }
}

export function graderIdentity(grader: Grader): GraderIdentity {
  return { id: grader.id ?? 'custom', label: grader.label ?? 'Injected grader' }
}

/** Grades both answers against the unsealed evaluation. A fixture grader only fits scripted answers, so it refuses a live one. */
export function gradeRun(
  grader: Grader,
  scenario: Scenario,
  evaluation: ScenarioEvaluation,
  responses: Record<AgentPath, AgentResponse>,
): GradedRun {
  const identity = graderIdentity(grader)
  if (identity.id === 'fixture-grader' && (responses.baseline.live || responses.guarded.live)) {
    throw new Error('The fixture grader only holds hand scores for the scripted answers; a live answer must be graded by the rule grader.')
  }
  return {
    responses,
    scores: {
      rubricVersion: grader.rubricVersion(scenario),
      baseline: grader.grade(scenario, evaluation, 'baseline', responses.baseline),
      guarded: grader.grade(scenario, evaluation, 'guarded', responses.guarded),
    },
    grader: identity,
  }
}
