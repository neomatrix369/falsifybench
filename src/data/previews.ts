import type { ScenarioPreview } from '../domain/types'

export const comingNextPreviews: ScenarioPreview[] = [
  {
    id: 'RV-001',
    track: 'Research validity',
    title: 'Treatment-effect claim',
    description:
      'An agent reports a treatment effect from a study summary that is missing its control arm and an obvious confounder. The guarded path should withhold the causal claim and request the missing comparison.',
  },
]
