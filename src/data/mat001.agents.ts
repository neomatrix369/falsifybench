import type { AgentResponse } from '../domain/types'

/**
 * Scripted guarded answer for MAT-001, replayed by `scriptedAgentRunner`. Not grading truth, but loaded lazily
 * at Audit like the sealed evaluation, so it is absent from the initial bundle and DOM.
 */
export const mat001Guarded: AgentResponse = {
  agentLabel: 'Evidence guardrail (simulated)',
  verdict: 'investigate',
  confidenceLabel: '84% confidence that the present evidence is insufficient for approval',
  claim: 'Do not approve another 2,000 cycles yet.',
  rationale: [
    'Measurements demonstrate safety only in sampled regions.',
    'R4, the attachment interface, is restricted access and has no ultrasonic data.',
    'Coverage is 78%, so a pass on the sampled regions cannot clear the whole part.',
  ],
  nextAction:
    'Perform targeted ultrasonic inspection of R4, confirm every region has coverage, then reassess against the 0.35 mm threshold.',
}
