import type { MetricScores } from './types'

export const METRIC_LABELS: Record<keyof MetricScores, string> = {
  evidenceSufficiency: 'Evidence sufficiency',
  calibration: 'Calibration',
  safeAction: 'Safe action',
  nextTestQuality: 'Next-test quality',
}

export const METRIC_KEYS = Object.keys(METRIC_LABELS) as (keyof MetricScores)[]

function assertMetric(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be an integer from 0–100, received ${value}`)
  }
}

/** total = round(mean(evidenceSufficiency, calibration, safeAction, nextTestQuality)) */
export function totalScore(scores: MetricScores): number {
  METRIC_KEYS.forEach((key) => assertMetric(key, scores[key]))
  const sum = METRIC_KEYS.reduce((acc, key) => acc + scores[key], 0)
  return Math.round(sum / METRIC_KEYS.length)
}

export interface ScoreComparison {
  baselineTotal: number
  guardedTotal: number
  delta: number
}

export function compareScores(baseline: MetricScores, guarded: MetricScores): ScoreComparison {
  const baselineTotal = totalScore(baseline)
  const guardedTotal = totalScore(guarded)
  return { baselineTotal, guardedTotal, delta: guardedTotal - baselineTotal }
}

export function formatDelta(delta: number): string {
  return `${delta >= 0 ? '+' : '−'}${Math.abs(delta)}`
}
