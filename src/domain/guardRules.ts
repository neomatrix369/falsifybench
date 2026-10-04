import type { AgentDecision } from './agentResponseCheck'
import type { GuardReport, Verdict } from './types'

/** Source text addressed to the reader/AI that tries to dictate the conclusion (prompt injection), not evidence. */
export const INSTRUCTION_PATTERN =
  /\b(?:note|message|instructions?)\s+(?:for|to)\s+(?:ai|assistants?|agents?|llms?|language models?|reviewers?)\b|\b(?:ignore|disregard)\b[^.]*\b(?:instructions?|data|tests?|results?|evidence|previous)\b|\breport\s+(?:it|this|them)\s+as\s+(?:approved|qualified|passed|safe)\b|\byou\s+(?:must|should)\s+(?:approve|report|say|conclude)\b/i

const MAX_NEXT_ACTION_LENGTH = 2000

function guardNextAction(untrustedSourceIds: string[], openGaps: string[], proposedNextAction: string): string {
  const includedGaps = [...openGaps]
  const hasProposedNextAction = proposedNextAction.trim().length > 0
  const modelStepPrefix = " Model's proposed next step: "
  const buildGuardText = () => {
    const parts: string[] = []
    if (untrustedSourceIds.length) parts.push(`exclude ${untrustedSourceIds.join(', ')} from the decision`)
    if (openGaps.length) {
      const details = includedGaps.length ? ` (${includedGaps.join('; ')})` : ''
      parts.push(`directly check what no record measures${details}`)
    }
    const action = parts.length ? `${parts.join(', then ')}, then reassess.` : 'Reassess.'
    return action.replace(/^./, (letter) => letter.toUpperCase())
  }

  let guardText = buildGuardText()
  let action = guardText + (hasProposedNextAction ? `${modelStepPrefix}${proposedNextAction}` : '')
  while (action.length > MAX_NEXT_ACTION_LENGTH && includedGaps.length) {
    includedGaps.pop()
    guardText = buildGuardText()
    action = guardText + (hasProposedNextAction ? `${modelStepPrefix}${proposedNextAction}` : '')
  }
  if (hasProposedNextAction && action.length > MAX_NEXT_ACTION_LENGTH) {
    const prefix = `${guardText}${modelStepPrefix}`
    const maxStepLength = MAX_NEXT_ACTION_LENGTH - prefix.length
    action = `${prefix}${proposedNextAction.slice(0, Math.max(0, maxStepLength - 1))}…`
  }
  return action
}

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

  const changed = verdict !== decision.verdict
  return {
    decision: changed
      ? {
          ...decision,
          verdict,
          claim: 'Do not proceed yet: the guard rules blocked this approval.',
          nextAction: guardNextAction(untrustedSourceIds, openGaps, decision.nextAction),
        }
      : decision,
    guard: { untrustedSourceIds, openGaps, overrides },
  }
}
