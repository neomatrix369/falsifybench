import type { Verdict } from './types'

/** The decision a live agent must return, as a JSON schema for structured output (Anthropic tool input). */
export const AGENT_DECISION_FIELDS = ['verdict', 'confidenceLabel', 'claim', 'rationale', 'nextAction'] as const

export type AgentDecision = { verdict: Verdict; confidenceLabel: string; claim: string; rationale: string[]; nextAction: string }

const VERDICTS: Verdict[] = ['proceed', 'investigate', 'abstain']

export const AGENT_DECISION_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: VERDICTS, description: 'proceed, investigate or abstain' },
    confidenceLabel: { type: 'string', description: 'Confidence in the verdict as a percentage, e.g. "80%"' },
    claim: { type: 'string', description: 'One sentence stating the decision' },
    rationale: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6, description: 'Reasons, each citing evidence IDs' },
    nextAction: { type: 'string', description: 'The single next step to take' },
  },
  required: [...AGENT_DECISION_FIELDS],
  additionalProperties: false,
} as const

const LIMITS = { text: 2000, rationaleItems: 6 }

const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '' && v.length <= LIMITS.text

/** Every problem with a model's decision at once; empty when it can be used as an `AgentResponse`. */
export function agentDecisionProblems(input: unknown): string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return ['decision is not an object']
  const d = input as Record<string, unknown>
  const problems: string[] = []
  if (!VERDICTS.includes(d.verdict as Verdict)) problems.push(`verdict must be one of ${VERDICTS.join(', ')} (got ${JSON.stringify(d.verdict)})`)
  for (const k of ['confidenceLabel', 'claim', 'nextAction'] as const) {
    if (!isText(d[k])) problems.push(`${k} must be a non-empty string of at most ${LIMITS.text} characters`)
  }
  const r = d.rationale
  if (!Array.isArray(r) || r.length === 0 || r.length > LIMITS.rationaleItems) {
    problems.push(`rationale must be a list of 1–${LIMITS.rationaleItems} strings`)
  } else {
    r.forEach((line, i) => {
      if (!isText(line)) problems.push(`rationale[${i}] must be a non-empty string of at most ${LIMITS.text} characters`)
    })
  }
  const extra = Object.keys(d).filter((k) => !(AGENT_DECISION_FIELDS as readonly string[]).includes(k))
  if (extra.length) problems.push(`unexpected field${extra.length > 1 ? 's' : ''}: ${extra.join(', ')}`)
  return problems
}

/** Copies only the declared decision fields, trimmed. Call after `agentDecisionProblems` returned none. */
export function toAgentDecision(input: unknown): AgentDecision {
  const d = input as AgentDecision
  return {
    verdict: d.verdict,
    confidenceLabel: d.confidenceLabel.trim(),
    claim: d.claim.trim(),
    rationale: d.rationale.map((line) => line.trim()),
    nextAction: d.nextAction.trim(),
  }
}
