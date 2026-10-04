import { ruleGrader } from './grader'
import type { Grader } from './types'

/** The rule grader (src/domain/grader.ts, docs/GRADER.md) behind the `Grader` seam. It scores any answer, so live runs use it. */
export const ruleGraderSeam: Grader = {
  id: 'rule-grader',
  label: `Rule grader ${ruleGrader.rubricVersion}: deterministic rules over each answer (docs/GRADER.md)`,
  rubricVersion: () => ruleGrader.rubricVersion,
  grade: (scenario, evaluation, _agent, response) => ruleGrader.grade(scenario, evaluation, response),
}
