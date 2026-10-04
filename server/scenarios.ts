// Public scenario fixtures only. Never import *.evaluation.ts, *.scores.ts, *.agents.ts or fixtureScores here:
// server/importGraph.test.ts fails if the server's import graph reaches them.
import { ei001 } from '../src/data/ei001'
import { lab001 } from '../src/data/lab001'
import { mat001 } from '../src/data/mat001'
import type { EvidenceItem, Scenario } from '../src/domain/types'

/** What the live baseline sees: the brief, the question and the evidence. No baseline answer and no sealed evaluation. */
export interface PublicScenario {
  id: string
  version: string
  title: string
  domain: string
  question: string
  task: string
  input: string
  guardedAgentLabel: string
  evidence: Pick<EvidenceItem, 'id' | 'kind' | 'title' | 'finding' | 'excerpt'>[]
}

function toPublic(s: Scenario): PublicScenario {
  return {
    id: s.id,
    version: s.version,
    title: s.title,
    domain: s.domain,
    question: s.question,
    task: s.brief.task,
    input: s.brief.input,
    guardedAgentLabel: s.guardedAgentLabel,
    evidence: s.evidence.map(({ id, kind, title, finding, excerpt }) => ({ id, kind, title, finding, ...(excerpt ? { excerpt } : {}) })),
  }
}

const PUBLIC: Record<string, PublicScenario> = Object.fromEntries([ei001, lab001, mat001].map((s) => [s.id, toPublic(s)]))

export const PUBLIC_SCENARIO_IDS = Object.keys(PUBLIC)

export function publicScenario(id: string): PublicScenario | null {
  return Object.hasOwn(PUBLIC, id) ? PUBLIC[id] : null
}
