import type { AgentResponse, AgentRunner } from '../domain/types'
import { EI_001_ID } from './ei001'
import { LAB_001_ID } from './lab001'
import { MAT_001_ID } from './mat001'

/** Scripted guarded answers, each its own lazy chunk requested at Audit, so none is in the main bundle or the DOM before then. */
const SCRIPTED_GUARDED: Record<string, () => Promise<AgentResponse>> = {
  [MAT_001_ID]: () => import('./mat001.agents').then((m) => m.mat001Guarded),
  [EI_001_ID]: () => import('./ei001.agents').then((m) => m.ei001Guarded),
  [LAB_001_ID]: () => import('./lab001.agents').then((m) => m.lab001Guarded),
}

/** Only implemented runner in the PoC: replays fixed answers. No model is called. */
export const scriptedAgentRunner: AgentRunner = {
  async run(agent, scenario) {
    if (agent === 'baseline') return scenario.baseline
    const load = SCRIPTED_GUARDED[scenario.id]
    if (!load) throw new Error(`No scripted guarded answer for ${scenario.id}`)
    return load()
  },
}
