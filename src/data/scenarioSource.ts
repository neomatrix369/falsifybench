import type { Scenario, ScenarioSource } from '../domain/types'
import { mat001 } from './mat001'

const SYNTHETIC_SCENARIOS: Record<string, Scenario> = {
  [mat001.id]: mat001,
}

/** Only implemented source in the PoC. Needs no network or secret. */
export const syntheticScenarioSource: ScenarioSource = {
  async loadScenario(id: string): Promise<Scenario> {
    const scenario = SYNTHETIC_SCENARIOS[id]
    if (!scenario) throw new Error(`Unknown synthetic scenario: ${id}`)
    return scenario
  },
}
