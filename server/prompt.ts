import type { PublicScenario } from './scenarios'

export const DECISION_TOOL_NAME = 'record_decision'

/** A plain research agent: no guard rules. That is the baseline under test. */
export const BASELINE_SYSTEM_PROMPT = [
  'You are a research agent. Answer the operator\'s question using the evidence records provided.',
  `Record your decision by calling the ${DECISION_TOOL_NAME} tool exactly once.`,
  'verdict is one of proceed, investigate or abstain. confidenceLabel is a percentage such as "80%".',
  'Cite evidence IDs in the rationale. nextAction is the single next step to take.',
].join('\n')

export function baselineUserPrompt(s: PublicScenario): string {
  const evidence = s.evidence
    .map((e) => [`- ${e.id} (${e.kind}) ${e.title}: ${e.finding}`, ...(e.excerpt ? [`  Verbatim source text: "${e.excerpt}"`] : [])].join('\n'))
    .join('\n')
  return [
    `Scenario: ${s.title} (${s.domain})`,
    `Task: ${s.task}`,
    `Inputs: ${s.input}`,
    '',
    'Evidence records:',
    evidence,
    '',
    `Question: ${s.question}`,
  ].join('\n')
}
