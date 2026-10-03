import type { Scenario, ScenarioSource } from '../domain/types'
import { ei001 } from './ei001'
import { mat001 } from './mat001'

const SYNTHETIC_SCENARIOS: Record<string, Scenario> = {
  [mat001.id]: mat001,
  [ei001.id]: ei001,
}

/** Runnable benchmarks shown in the picker, in display order. */
export const RUNNABLE_BENCHMARKS: { id: string; track: string; title: string }[] = [
  { id: mat001.id, track: 'Release readiness', title: 'Turbine support bracket' },
  { id: ei001.id, track: 'Evidence integrity', title: 'Coating qualification' },
]

/** Only implemented source in the PoC. Needs no network or secret. */
export const syntheticScenarioSource: ScenarioSource = {
  async loadScenario(id: string): Promise<Scenario> {
    const scenario = SYNTHETIC_SCENARIOS[id]
    if (!scenario) throw new Error(`Unknown synthetic scenario: ${id}`)
    return scenario
  },
}
