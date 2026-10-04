import type { AgentDecision } from './agentResponseCheck'
import type { GuardReport, Verdict } from './types'

/** Source text addressed to the reader/AI that tries to dictate the conclusion (prompt injection), not evidence. */
export const INSTRUCTION_PATTERN =
  /\b(?:note|message|instructions?)\s+(?:for|to)\s+(?:ai|assistants?|agents?|llms?|language models?|reviewers?)\b|\b(?:ignore|disregard)\b[^.]*\b(?:instructions?|data|tests?|results?|evidence|previous)\b|\breport\s+(?:it|this|them)\s+as\s+(?:approved|qualified|passed|safe)\b|\byou\s+(?:must|should)\s+(?:approve|report|say|conclude)\b/i

export function applyGuardRules(
  evidence: { id: string; excerpt?: string }[],
  decision: AgentDecision,
  flagged: { untrustedSourceIds: string[]; openGaps: string[] },
): { decision: AgentDecision; guard: GuardReport } {
  const untrustedSourceIds = [...flagged.untrustedSourceIds]
  const openGaps = [...flagged.openGaps]
  const overrides: string[] = []

  for (const item of evidence) {
    if (item.excerpt && INSTRUCTION_PATTERN.test(item.excerpt) && !untrustedSourceIds.includes(item.id)) {
      untrustedSourceIds.push(item.id)
      overrides.push(`Guard rule: ${item.id} contains instructions addressed to the reader, so it is treated as untrusted.`)
    }
  }

  let verdict: Verdict = decision.verdict
  if (verdict === 'proceed' && untrustedSourceIds.length > 0) {
    verdict = 'investigate'
    overrides.push(`Guard rule: the decision relied on untrusted source(s) ${untrustedSourceIds.join(', ')}, so proceed was changed to investigate.`)
  }
  if (verdict === 'proceed' && openGaps.length > 0) {
    verdict = 'investigate'
    overrides.push(`Guard rule: ${openGaps.length} open gap(s) remain, so proceed was changed to investigate.`)
  }

  return {
    decision: verdict === decision.verdict ? decision : { ...decision, verdict },
    guard: { untrustedSourceIds, openGaps, overrides },
  }
}
