// @vitest-environment node
// Data gate S1 (npm run score): the MAT-001 synthetic data matches its fixture spec in the playbook.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mat001 } from '../../src/data/mat001'
import { comingNextPreviews } from '../../src/data/previews'
import { RUNNABLE_BENCHMARKS } from '../../src/data/scenarioSource'
import { scriptedAgentRunner } from '../../src/data/scriptedAgentRunner'
import { gradeRun, runAgents } from '../../src/domain/agentRun'
import { fixtureGrader } from '../../src/domain/fixtureGrader'
import { compareScores, totalScore } from '../../src/domain/scoring'

const spec = readFileSync(process.env.SCORE_PLAYBOOK ?? new URL('../../docs/falsifybench-playbook.md', import.meta.url), 'utf8')
const between = (src: string, a: string, b: string) => src.slice(src.indexOf(a), src.indexOf(b))
const fixture = between(spec, '## Primary deterministic scenario fixture', '## Evidence-integrity scenario fixture')
const baselineSec = between(fixture, '### Fixed baseline result', '### Fixed guarded result')
const guardedSec = between(fixture, '### Fixed guarded result', '### Scorecard')
const tick = (src: string, label: string) => new RegExp(`- ${label}: \`([^\`]+)\``).exec(src)?.[1]
const plain = (src: string, label: string) => new RegExp(`- ${label}: (.+)`).exec(src)?.[1].trim()
const norm = (s = '') => s.toLowerCase().replace(/[.\s]+$/, '').trim()
const evidenceRows = [...fixture.matchAll(/^\| `(EV-[A-Z]+-\d+)` [^|]+\| (.+?) \|$/gm)].map((m) => ({ id: m[1], finding: m[2] }))
const scoreRows = Object.fromEntries(
  [...fixture.matchAll(/^\| (Evidence sufficiency|Calibration|Safe action|Next-test quality|Total) \| (\d+) \| (\d+) \|$/gm)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]),
)
const metricOrder = ['evidenceSufficiency', 'calibration', 'safeAction', 'nextTestQuality'] as const
const metricRows = ['Evidence sufficiency', 'Calibration', 'Safe action', 'Next-test quality']
const HIDDEN = ['highest-stress', 'zero ultrasonic']
const loadEval = () => mat001.evaluation.unseal()
const loadGuarded = () => scriptedAgentRunner.run('guarded', mat001)
const loadScores = async () => gradeRun(fixtureGrader, mat001, await loadEval(), await runAgents(scriptedAgentRunner, mat001)).scores

describe('Spec: MAT-001 identity and provenance', () => {
  it('id/version/title/question match spec', () => {
    expect(mat001.id).toBe(tick(fixture, 'ID'))
    expect(mat001.version).toBe(tick(fixture, 'Version'))
    expect(mat001.title).toBe(tick(fixture, 'Title'))
    expect(mat001.question).toBe(tick(fixture, 'Question'))
  })
  it('provenance is synthetic hand-audited', () => {
    expect(fixture).toContain('`Synthetic · hand-audited`')
    expect(mat001.provenance.status).toBe('synthetic_hand_audited')
    expect(mat001.provenance.label).toBe('Synthetic · hand-audited')
  })
})

describe('Spec: visible evidence', () => {
  it('spec table parsed (5 rows)', () => expect(evidenceRows).toHaveLength(5))
  for (let i = 0; i < 5; i++) {
    it(`evidence row ${i + 1} id + finding match spec`, () => {
      expect(mat001.evidence[i].id).toBe(evidenceRows[i].id)
      expect(mat001.evidence[i].finding).toBe(evidenceRows[i].finding)
    })
  }
  it('five-region schematic with R4 restricted', () => {
    expect(mat001.regions.map((r) => r.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5'])
    expect(mat001.regions.find((r) => r.id === 'R4')?.note).toMatch(/restricted/i)
  })
  it('public scenario object carries no sealed evaluation terms', () => {
    const pub = JSON.stringify(mat001).toLowerCase()
    HIDDEN.forEach((h) => expect(pub).not.toContain(h))
  })
})

describe('Spec: fixed agent results', () => {
  it('baseline verdict/confidence/next action match spec', () => {
    expect(mat001.baseline.verdict).toBe(norm(tick(baselineSec, 'Verdict')))
    expect(mat001.baseline.confidenceLabel).toBe(tick(baselineSec, 'Confidence'))
    expect(norm(mat001.baseline.nextAction)).toBe(norm(plain(baselineSec, 'Next action')))
  })
  it('guarded verdict/confidence/next action match spec', async () => {
    const guarded = await loadGuarded()
    expect(guarded.verdict).toBe(norm(tick(guardedSec, 'Verdict')))
    expect(guarded.confidenceLabel).toBe(tick(guardedSec, 'Confidence'))
    expect(norm(guarded.nextAction)).toBe(norm(plain(guardedSec, 'Next action')))
  })
  it('sealed evaluation truth matches spec (R4, readings, expected verdict, next action)', async () => {
    const ev = await loadEval()
    expect(ev.hiddenTruth.regionId).toBe('R4')
    expect(ev.hiddenTruth.readingsInRegion).toBe(0)
    expect(ev.hiddenTruth.regionRole).toMatch(/highest-stress/)
    expect(ev.expectedSafeVerdict).toBe(norm(/Expected safe verdict is `([^`]+)`/.exec(fixture)?.[1]))
    expect(ev.sufficientNextAction).toMatch(/ultrasonic inspection of R4/i)
  })
})

describe('Spec: scorecard', () => {
  it('rubric version matches spec', async () => {
    expect((await loadScores()).rubricVersion).toBe(/Rubric version: `([^`]+)`/.exec(fixture)?.[1])
  })
  it('baseline metric inputs match spec', async () => {
    const s = (await loadScores()).baseline
    metricOrder.forEach((k, i) => expect(s[k]).toBe(scoreRows[metricRows[i]][0]))
  })
  it('guarded metric inputs match spec', async () => {
    const s = (await loadScores()).guarded
    metricOrder.forEach((k, i) => expect(s[k]).toBe(scoreRows[metricRows[i]][1]))
  })
  it('computed totals and delta equal spec totals', async () => {
    const { baseline, guarded } = (await loadScores())
    expect(totalScore(baseline)).toBe(scoreRows.Total[0])
    expect(totalScore(guarded)).toBe(scoreRows.Total[1])
    expect(compareScores(baseline, guarded).delta).toBe(Number(/`\+(\d+) release-readiness points`/.exec(fixture)?.[1]))
  })
  it('fixture supplies no precomputed total or delta', async () => {
    const sc = JSON.stringify((await loadScores()))
    expect(sc).not.toMatch(/"total"|"delta"/)
  })
})

describe('Spec: coming next', () => {
  it('every spec track is either runnable or a non-runnable preview, never both', () => {
    const runnable = RUNNABLE_BENCHMARKS.map((b) => b.track)
    const previews = comingNextPreviews.map((p) => p.track)
    expect([...runnable, ...previews].sort()).toEqual(['Evidence integrity', 'Lab automation', 'Release readiness', 'Research validity'])
  })
})
