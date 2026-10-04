import { ei001Guarded } from '../data/ei001.agents'
import { lab001Guarded } from '../data/lab001.agents'
import { mat001Guarded } from '../data/mat001.agents'
import { gradeRun } from '../domain/agentRun'
import { fixtureGrader } from '../domain/fixtureGrader'
import type { AgentResponse, GradedRun, Scenario, ScenarioEvaluation } from '../domain/types'

const GUARDED: Record<string, AgentResponse> = { 'MAT-001': mat001Guarded, 'EI-001': ei001Guarded, 'LAB-001': lab001Guarded }

/** What the default seams produce for a scenario (scripted answers, fixture grades), built synchronously for tests. */
export function scriptedRun(scenario: Scenario, evaluation: ScenarioEvaluation, guarded: Partial<AgentResponse> = {}): GradedRun {
  return gradeRun(fixtureGrader, scenario, evaluation, { baseline: scenario.baseline, guarded: { ...GUARDED[scenario.id], ...guarded } })
}
