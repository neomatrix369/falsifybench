import type { AgentResponse } from './types'

/** A live baseline answer as the browser holds it after `liveAgentRunner`: decision fields plus the call's facts. */
export function liveAnswer(overrides: Partial<AgentResponse> = {}): AgentResponse {
  return {
    agentLabel: 'Baseline agent (live: claude-stub-1)',
    verdict: 'proceed',
    confidenceLabel: '86%',
    claim: 'The evidence supports going ahead as asked.',
    rationale: ['EV-SALT-01 supports the request.'],
    nextAction: 'Proceed with the requested sign-off.',
    live: {
      provider: 'anthropic',
      model: 'claude-stub-1',
      requestId: 'req_stub_0001',
      latencyMs: 412,
      roundTripMs: 431,
      endpoint: '/api/agents/baseline',
      validatedFields: ['verdict', 'confidenceLabel', 'claim', 'rationale', 'nextAction'],
    },
    ...overrides,
  }
}
