// @vitest-environment node
// Data gate S1 (npm run score): the LAB-001 synthetic data matches its fixture spec in the playbook.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lab001 } from '../../src/data/lab001'
import { RUNNABLE_BENCHMARKS } from '../../src/data/scenarioSource'
import { scriptedAgentRunner } from '../../src/data/scriptedAgentRunner'
import { gradeRun, runAgents } from '../../src/domain/agentRun'
import { fixtureGrader } from '../../src/domain/fixtureGrader'
import { compareScores, totalScore } from '../../src/domain/scoring'

const spec = readFileSync(process.env.SCORE_PLAYBOOK ?? new URL('../../docs/falsifybench-playbook.md', import.meta.url), 'utf8')
const between = (src: string, a: string, b: string) => src.slice(src.indexOf(a), src.indexOf(b))
const tick = (src: string, label: string) => new RegExp(`- ${label}: \`([^\`]+)\``).exec(src)?.[1]
const plain = (src: string, label: string) => new RegExp(`- ${label}: (.+)`).exec(src)?.[1].trim()
const norm = (s = '') => s.toLowerCase().replace(/[.\s]+$/, '').trim()
const metricOrder = ['evidenceSufficiency', 'calibration', 'safeAction', 'nextTestQuality'] as const
const metricRows = ['Evidence sufficiency', 'Calibration', 'Safe action', 'Next-test quality']

const labFixture = between(spec, '## Lab-automation scenario fixture', '## Data and code contracts')
const labBaselineSec = between(labFixture, '### Fixed baseline result', '### Fixed guarded result')
const labGuardedSec = between(labFixture, '### Fixed guarded result', '### Scorecard')
const labEvidenceRows = [...labFixture.matchAll(/^\| `(EV-[A-Z]+-\d+)` [^|]+\| (.+?) \|$/gm)].map((m) => ({ id: m[1], finding: m[2] }))
const labScoreRows = Object.fromEntries(
  [...labFixture.matchAll(/^\| (Evidence sufficiency|Calibration|Safe action|Next-test quality|Total) \| (\d+) \| (\d+) \|$/gm)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]),
)
const LAB_HIDDEN = ['stale state', 'crash', 'rectification', 'excluded']
const loadLabEval = () => lab001.evaluation.unseal()
const loadGuarded = () => scriptedAgentRunner.run('guarded', lab001)
const loadScores = async () => gradeRun(fixtureGrader, lab001, await loadLabEval(), await runAgents(scriptedAgentRunner, lab001)).scores

describe('Spec: LAB-001 identity, evidence and stale operator message', () => {
  it('id/version/title/question match spec', () => {
    expect(lab001.id).toBe(tick(labFixture, 'ID'))
    expect(lab001.version).toBe(tick(labFixture, 'Version'))
    expect(lab001.title).toBe(tick(labFixture, 'Title'))
    expect(lab001.question).toBe(tick(labFixture, 'Question'))
    expect(lab001.provenance.label).toBe('Synthetic · hand-audited')
  })
  it('is registered as a runnable benchmark', () => {
    expect(RUNNABLE_BENCHMARKS.map((b) => b.id)).toContain('LAB-001')
  })
  it('five evidence rows match spec', () => {
    expect(labEvidenceRows).toHaveLength(5)
    labEvidenceRows.forEach((row, i) => expect([lab001.evidence[i].id, lab001.evidence[i].finding]).toEqual([row.id, row.finding]))
  })
  it('operator excerpt matches spec verbatim and sits on the untrusted source', async () => {
    const sup = lab001.evidence.find((e) => e.excerpt)
    expect(sup?.excerpt).toBe(tick(labFixture, 'Operator excerpt'))
    expect(sup?.id).toBe(tick(labFixture, 'Untrusted source'))
    expect((await loadLabEval()).hiddenTruth.untrustedEvidenceIds).toEqual([sup?.id])
  })
  it('public scenario object carries no sealed evaluation terms', () => {
    const pub = JSON.stringify({ ...lab001, evaluation: undefined }).toLowerCase()
    LAB_HIDDEN.forEach((h) => expect(pub).not.toContain(h))
  })
})

describe('Spec: LAB-001 fixed results and scorecard', () => {
  it('baseline verdict/confidence/next action match spec', () => {
    expect(lab001.baseline.verdict).toBe(norm(tick(labBaselineSec, 'Verdict')))
    expect(lab001.baseline.confidenceLabel).toBe(tick(labBaselineSec, 'Confidence'))
    expect(norm(lab001.baseline.nextAction)).toBe(norm(plain(labBaselineSec, 'Next action')))
  })
  it('guarded verdict/confidence/next action and expected verdict match spec', async () => {
    const ev = await loadLabEval()
    const guarded = await loadGuarded()
    expect(guarded.verdict).toBe(norm(tick(labGuardedSec, 'Verdict')))
    expect(guarded.confidenceLabel).toBe(tick(labGuardedSec, 'Confidence'))
    expect(norm(guarded.nextAction)).toBe(norm(plain(labGuardedSec, 'Next action')))
    expect(ev.expectedSafeVerdict).toBe(norm(/Expected safe verdict is `([^`]+)`/.exec(labFixture)?.[1]))
  })
  it('guarded basis and turn tags match spec, and the guard stops then the agent resumes', async () => {
    const ev = await loadLabEval()
    expect(ev.guardedBasis).toEqual([...(plain(labGuardedSec, 'Decided from public evidence') ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]))
    expect(ev.turns?.baseline).toEqual([.../Baseline turns, tagged only after Audit: (.+)\./.exec(labFixture)![1].matchAll(/`([^`]+)`/g)].map((m) => m[1]))
    expect(ev.turns?.baseline).toHaveLength(lab001.baselineTurns?.length ?? 0)
    expect(ev.turns?.guarded.map((t) => `${t.by}:${t.kind}`)).toEqual([
      'agent:productive', 'agent:productive', 'guard:rectification', 'agent:rectification', 'agent:productive',
    ])
  })
  it('rubric, metric inputs, totals and delta match spec', async () => {
    const { rubricVersion, baseline, guarded } = (await loadScores())
    expect(rubricVersion).toBe(/Rubric version: `([^`]+)`/.exec(labFixture)?.[1])
    metricOrder.forEach((k, i) => expect([baseline[k], guarded[k]]).toEqual(labScoreRows[metricRows[i]]))
    expect([totalScore(baseline), totalScore(guarded)]).toEqual(labScoreRows.Total)
    expect(compareScores(baseline, guarded).delta).toBe(Number(/`\+(\d+) release-readiness points`/.exec(labFixture)?.[1]))
  })
})
