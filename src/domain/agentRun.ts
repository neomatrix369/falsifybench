import type { AgentPath, AgentResponse, AgentRunner, GradedRun, Grader, Scenario, ScenarioEvaluation } from './types'

/** Asks the runner for both agents' answers on one scenario. */
export async function runAgents(runner: AgentRunner, scenario: Scenario): Promise<Record<AgentPath, AgentResponse>> {
  const [baseline, guarded] = await Promise.all([runner.run('baseline', scenario), runner.run('guarded', scenario)])
  return { baseline, guarded }
}

/** Grades both answers against the unsealed evaluation. */
export function gradeRun(
  grader: Grader,
  scenario: Scenario,
  evaluation: ScenarioEvaluation,
  responses: Record<AgentPath, AgentResponse>,
): GradedRun {
  return {
    responses,
    scores: {
      rubricVersion: grader.rubricVersion(scenario),
      baseline: grader.grade(scenario, evaluation, 'baseline', responses.baseline),
      guarded: grader.grade(scenario, evaluation, 'guarded', responses.guarded),
    },
  }
}
