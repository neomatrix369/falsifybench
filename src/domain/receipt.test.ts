// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { syntheticScenarioSource } from '../data/scenarioSource'
import { scriptedAgentRunner } from '../data/scriptedAgentRunner'
import { gradeRun, runAgents } from './agentRun'
import { fixtureGrader } from './fixtureGrader'
import { liveAnswer } from './liveFixtures.test-helpers'
import { createReceipt, type BenchmarkReceipt } from './receipt'
import { ruleGraderSeam } from './ruleGraderSeam'
import { STAGES } from './stages'
import type { AgentResponse, Grader } from './types'

const events = STAGES.map((stage, i) => ({ order: i + 1, stage, at: `2026-01-01T00:00:0${i + 1}.000Z` }))

async function receiptFor(grader: Grader, baseline?: AgentResponse): Promise<BenchmarkReceipt> {
  const scenario = await syntheticScenarioSource.loadScenario('EI-001')
  const evaluation = await scenario.evaluation.unseal()
  const responses = await runAgents(scriptedAgentRunner, scenario)
  const run = gradeRun(grader, scenario, evaluation, baseline ? { ...responses, baseline } : responses)
  return createReceipt({
    scenario,
    evaluation,
    run,
    runId: 'RUN-0000BEEF',
    startedAt: '2026-01-01T00:00:00.000Z',
    events,
    mode: 'synthetic',
    clock: () => new Date('2026-01-01T00:00:09.000Z'),
  })
}

describe('receipt versions', () => {
  it('scripted answers graded by the fixture grader stay v1.0 with no extension fields', async () => {
    const receipt = await receiptFor(fixtureGrader)
    expect(receipt.receiptVersion).toBe('1.0')
    expect(receipt.agentExecution).toBe('scripted_fixture')
    expect(receipt).not.toHaveProperty('grader')
    expect(receipt).not.toHaveProperty('liveCalls')
  })

  it('a live baseline graded by the rule grader is v1.1 and records the model, request and grader', async () => {
    const receipt = await receiptFor(ruleGraderSeam, liveAnswer())
    expect(receipt.receiptVersion).toBe('1.1')
    if (receipt.receiptVersion !== '1.1') return
    expect(receipt.agentExecution).toBe('live_baseline')
    expect(receipt.rubricVersion).toBe('RULE-GRADER-1.0')
    expect(receipt.grader).toEqual({ id: 'rule-grader', version: 'RULE-GRADER-1.0' })
    expect(receipt.agents.baseline).toBe('Baseline agent (live: claude-stub-1)')
    expect(receipt.agents.guarded).toBe('Evidence guardrail (simulated)')
    expect(receipt.liveCalls).toEqual({
      baseline: {
        provider: 'anthropic',
        model: 'claude-stub-1',
        requestId: 'req_stub_0001',
        latencyMs: 412,
        validatedFields: ['verdict', 'confidenceLabel', 'claim', 'rationale', 'nextAction'],
      },
    })
    expect(receipt.verdicts.baseline).toBe('proceed')
  })

  it('v1.1 keeps every v1.0 field in the same order and only appends grader and liveCalls', async () => {
    const v1 = Object.keys(await receiptFor(fixtureGrader))
    const v11 = Object.keys(await receiptFor(ruleGraderSeam, liveAnswer()))
    expect(v11).toEqual([...v1, 'grader', 'liveCalls'])
  })

  it('scripted answers scored by the rule grader are v1.1 with no live calls, so the grader is never implied', async () => {
    const receipt = await receiptFor(ruleGraderSeam)
    expect(receipt.receiptVersion).toBe('1.1')
    if (receipt.receiptVersion !== '1.1') return
    expect(receipt.agentExecution).toBe('scripted_fixture')
    expect(receipt.liveCalls).toEqual({})
  })

  it('never carries the round trip, endpoint or anything key-like', async () => {
    const json = JSON.stringify(await receiptFor(ruleGraderSeam, liveAnswer()))
    expect(json).not.toMatch(/roundTripMs|endpoint|sk-ant|api[_-]?key/i)
  })
})

describe('gradeRun with a live answer', () => {
  it('refuses the fixture grader, whose hand scores only fit the scripted answers', async () => {
    await expect(receiptFor(fixtureGrader, liveAnswer())).rejects.toThrow(/fixture grader only holds hand scores/)
  })
})
