import { describe, expect, it } from 'vitest'
import { mat001Scores } from '../data/mat001.scores'
import { compareScores, formatDelta, totalScore } from './scoring'

describe('scoring', () => {
  it('computes totals as the rounded mean of the four metrics', () => {
    expect(totalScore(mat001Scores.baseline)).toBe(15)
    expect(totalScore(mat001Scores.guarded)).toBe(95)
  })

  it('computes a +80 delta from metric inputs only', () => {
    const result = compareScores(mat001Scores.baseline, mat001Scores.guarded)
    expect(result).toEqual({ baselineTotal: 15, guardedTotal: 95, delta: 80 })
    expect(formatDelta(result.delta)).toBe('+80')
  })

  it('fixture supplies no precomputed totals or delta', () => {
    expect(Object.keys(mat001Scores.baseline).sort()).toEqual(
      ['calibration', 'evidenceSufficiency', 'nextTestQuality', 'safeAction'],
    )
    expect(mat001Scores).not.toHaveProperty('delta')
  })

  it('rejects out-of-range or non-integer metrics', () => {
    expect(() => totalScore({ evidenceSufficiency: 101, calibration: 0, safeAction: 0, nextTestQuality: 0 })).toThrow(RangeError)
    expect(() => totalScore({ evidenceSufficiency: 1.5, calibration: 0, safeAction: 0, nextTestQuality: 0 })).toThrow(RangeError)
  })
})

describe('EI-001 scoring', async () => {
  const { ei001Scores } = await import('../data/ei001.scores')
  it('computes the EI-001 totals and delta from fixture inputs', () => {
    expect(compareScores(ei001Scores.baseline, ei001Scores.guarded)).toEqual({
      baselineTotal: 10,
      guardedTotal: 94,
      delta: 84,
    })
  })
})
