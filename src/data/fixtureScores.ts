import type { RubricScores } from '../domain/types'
import { ei001Scores } from './ei001.scores'
import { lab001Scores } from './lab001.scores'
import { mat001Scores } from './mat001.scores'
import { EI_001_ID } from './ei001'
import { LAB_001_ID } from './lab001'
import { MAT_001_ID } from './mat001'

/** Hand-entered rubric scores for the scripted answers, by scenario ID. */
export const FIXTURE_SCORES: Record<string, RubricScores> = {
  [MAT_001_ID]: mat001Scores,
  [EI_001_ID]: ei001Scores,
  [LAB_001_ID]: lab001Scores,
}
