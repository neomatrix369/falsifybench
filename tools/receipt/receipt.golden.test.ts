// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { syntheticScenarioSource } from '../../src/data/scenarioSource'
import { scriptedAgentRunner } from '../../src/data/scriptedAgentRunner'
import { gradeRun, runAgents } from '../../src/domain/agentRun'
import { fixtureGrader } from '../../src/domain/fixtureGrader'
import { createReceipt } from '../../src/domain/receipt'
import { STAGES } from '../../src/domain/stages'

const expected: Record<string, string> = JSON.parse(readFileSync(new URL('./receipts.main.json', import.meta.url), 'utf8'))

// Receipts captured from main (7c805a7) before guarded/scoring moved out of the sealed evaluation, with the same clock and run ID.
describe('receipt v1.0 is unchanged by the AgentRunner/Grader split', () => {
  it.each(['EI-001', 'LAB-001', 'MAT-001'] as const)('%s matches main byte for byte', async (id) => {
    const scenario = await syntheticScenarioSource.loadScenario(id)
    const evaluation = await scenario.evaluation.unseal()
    const run = gradeRun(fixtureGrader, scenario, evaluation, await runAgents(scriptedAgentRunner, scenario))
    const events = STAGES.map((stage, i) => ({ order: i + 1, stage, at: `2026-01-01T00:00:0${i + 1}.000Z` }))
    const receipt = createReceipt({
      scenario,
      evaluation,
      run,
      runId: 'RUN-0000BEEF',
      startedAt: '2026-01-01T00:00:00.000Z',
      events,
      mode: 'synthetic',
      clock: () => new Date('2026-01-01T00:00:09.000Z'),
    })
    expect(JSON.stringify(receipt, null, 2)).toBe(expected[id])
  })
})
