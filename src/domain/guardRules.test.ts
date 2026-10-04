import { describe, expect, it } from 'vitest'
import type { AgentDecision } from './agentResponseCheck'
import { applyGuardRules, INSTRUCTION_PATTERN } from './guardRules'
import { ei001 } from '../data/ei001'
import { lab001 } from '../data/lab001'
import { mat001 } from '../data/mat001'

const proceed: AgentDecision = {
  verdict: 'proceed',
  confidenceLabel: '80%',
  claim: 'The evidence supports proceeding.',
  rationale: ['EV-01 supports the claim.'],
  nextAction: 'Check EV-01 against the specification.',
}

describe('applyGuardRules', () => {
  it('matches only EI-001 EV-SUP-01 in the real EI, LAB and MAT evidence excerpts', () => {
    const fixtures = [ei001, lab001, mat001]
    const matches = fixtures.flatMap((scenario) =>
      scenario.evidence.filter((item) => item.excerpt && INSTRUCTION_PATTERN.test(item.excerpt)).map((item) => item.id),
    )
    expect(matches).toEqual(['EV-SUP-01'])

    const result = applyGuardRules(ei001.evidence, { ...proceed, verdict: 'investigate' }, { untrustedSourceIds: [], openGaps: [] })
    expect(result.guard).toEqual({
      untrustedSourceIds: ['EV-SUP-01'],
      openGaps: [],
      overrides: ['Guard rule: EV-SUP-01 contains instructions addressed to the reader, so it is treated as untrusted.'],
    })
  })

  it('changes proceed to investigate for untrusted sources with the exact R1 override', () => {
    const result = applyGuardRules([], proceed, { untrustedSourceIds: ['EV-01'], openGaps: [] })
    expect(result.decision).toEqual({ ...proceed, verdict: 'investigate' })
    expect(result.guard.overrides).toEqual([
      'Guard rule: the decision relied on untrusted source(s) EV-01, so proceed was changed to investigate.',
    ])
  })

  it('changes proceed to investigate for open gaps with the exact R2 override', () => {
    const result = applyGuardRules([], proceed, { untrustedSourceIds: [], openGaps: ['Unmeasured region', 'Missing test'] })
    expect(result.decision).toEqual({ ...proceed, verdict: 'investigate' })
    expect(result.guard.overrides).toEqual(['Guard rule: 2 open gap(s) remain, so proceed was changed to investigate.'])
  })

  it('leaves investigate unchanged with no overrides', () => {
    const decision = { ...proceed, verdict: 'investigate' as const }
    const result = applyGuardRules([], decision, { untrustedSourceIds: [], openGaps: [] })
    expect(result.decision).toBe(decision)
    expect(result.guard.overrides).toEqual([])
  })

  it('leaves proceed unchanged when there are no untrusted sources, gaps or injected text', () => {
    const result = applyGuardRules([{ id: 'EV-01', excerpt: 'A direct measurement was recorded.' }], proceed, {
      untrustedSourceIds: [],
      openGaps: [],
    })
    expect(result.decision).toBe(proceed)
    expect(result.guard).toEqual({ untrustedSourceIds: [], openGaps: [], overrides: [] })
  })

  it('preserves decision fields when code changes the verdict', () => {
    const result = applyGuardRules([], proceed, { untrustedSourceIds: ['EV-01'], openGaps: [] })
    expect(result.decision).toMatchObject({
      confidenceLabel: proceed.confidenceLabel,
      claim: proceed.claim,
      rationale: proceed.rationale,
      nextAction: proceed.nextAction,
    })
  })
})
