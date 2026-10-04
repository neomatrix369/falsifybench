import { FIXTURE_SCORES } from '../data/fixtureScores'
import type { Grader, RubricScores } from './types'

/** A lookup, not a judge: returns the hand-entered scores for a scenario and agent, which only fit the scripted answers. */
export function createFixtureGrader(table: Record<string, RubricScores>): Grader {
  const entry = (id: string): RubricScores => {
    const scores = table[id]
    if (!scores) throw new Error(`No fixture scores for ${id}`)
    return scores
  }
  return {
    id: 'fixture-grader',
    label: 'Fixture grader: hand-entered scores for the scripted answers',
    rubricVersion: (scenario) => entry(scenario.id).rubricVersion,
    grade: (scenario, _evaluation, agent) => entry(scenario.id)[agent],
  }
}

export const fixtureGrader: Grader = createFixtureGrader(FIXTURE_SCORES)
