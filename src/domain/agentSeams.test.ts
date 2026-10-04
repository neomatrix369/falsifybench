import { describe, expect, it } from 'vitest'
import { ei001 } from '../data/ei001'
import { mat001 } from '../data/mat001'
import { mat001Guarded } from '../data/mat001.agents'
import { mat001Scores } from '../data/mat001.scores'
import { scriptedAgentRunner } from '../data/scriptedAgentRunner'
import { gradeRun, runAgents } from './agentRun'
import { createFixtureGrader, fixtureGrader } from './fixtureGrader'

describe('scriptedAgentRunner', () => {
  it('replays the public baseline and the lazily loaded scripted guarded answer', async () => {
    expect(await scriptedAgentRunner.run('baseline', mat001)).toBe(mat001.baseline)
    expect(await scriptedAgentRunner.run('guarded', mat001)).toBe(mat001Guarded)
  })

  it('rejects a scenario it has no script for', async () => {
    await expect(scriptedAgentRunner.run('guarded', { ...mat001, id: 'NOPE-1' })).rejects.toThrow(/NOPE-1/)
  })
})

describe('fixtureGrader', () => {
  it('looks up the hand-entered scores and rubric version', async () => {
    const evaluation = await mat001.evaluation.unseal()
    const run = gradeRun(fixtureGrader, mat001, evaluation, await runAgents(scriptedAgentRunner, mat001))
    expect(run.scores).toEqual(mat001Scores)
    expect(run.responses.guarded).toBe(mat001Guarded)
  })

  it('throws for a scenario with no fixture scores', () => {
    expect(() => createFixtureGrader({}).rubricVersion(ei001)).toThrow(/No fixture scores for EI-001/)
  })
})
