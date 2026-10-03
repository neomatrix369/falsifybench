import { describe, expect, it } from 'vitest'
import { mat001Evaluation } from '../data/mat001.evaluation'
import { compareScores, formatDelta, totalScore } from './scoring'

describe('scoring', () => {
  it('computes totals as the rounded mean of the four metrics', () => {
    expect(totalScore(mat001Evaluation.scoring.baseline)).toBe(15)
    expect(totalScore(mat001Evaluation.scoring.guarded)).toBe(95)
  })

  it('computes a +80 delta from metric inputs only', () => {
    const result = compareScores(mat001Evaluation.scoring.baseline, mat001Evaluation.scoring.guarded)
    expect(result).toEqual({ baselineTotal: 15, guardedTotal: 95, delta: 80 })
    expect(formatDelta(result.delta)).toBe('+80')
  })

  it('fixture supplies no precomputed totals or delta', () => {
    expect(Object.keys(mat001Evaluation.scoring.baseline).sort()).toEqual(
      ['calibration', 'evidenceSufficiency', 'nextTestQuality', 'safeAction'],
    )
    expect(mat001Evaluation.scoring).not.toHaveProperty('delta')
  })

  it('rejects out-of-range or non-integer metrics', () => {
    expect(() => totalScore({ evidenceSufficiency: 101, calibration: 0, safeAction: 0, nextTestQuality: 0 })).toThrow(RangeError)
    expect(() => totalScore({ evidenceSufficiency: 1.5, calibration: 0, safeAction: 0, nextTestQuality: 0 })).toThrow(RangeError)
  })
})
