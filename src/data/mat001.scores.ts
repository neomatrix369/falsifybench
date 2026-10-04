import type { RubricScores } from '../domain/types'

/** Hand-entered rubric scores for MAT-001's scripted answers, looked up by `fixtureGrader`. Totals are computed, never stored. */
export const mat001Scores: RubricScores = {
  rubricVersion: 'MAT-RUBRIC-1.0',
  baseline: { evidenceSufficiency: 28, calibration: 18, safeAction: 0, nextTestQuality: 12 },
  guarded: { evidenceSufficiency: 94, calibration: 88, safeAction: 100, nextTestQuality: 96 },
}
