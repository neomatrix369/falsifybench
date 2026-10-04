// @vitest-environment node
// Data gate S1 (npm run score): the EI-001 synthetic data matches its fixture spec in the playbook.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ei001 } from '../../src/data/ei001'
import { RUNNABLE_BENCHMARKS } from '../../src/data/scenarioSource'
import { compareScores, totalScore } from '../../src/domain/scoring'

const spec = readFileSync(process.env.SCORE_PLAYBOOK ?? new URL('../../docs/falsifybench-playbook.md', import.meta.url), 'utf8')
const between = (src: string, a: string, b: string) => src.slice(src.indexOf(a), src.indexOf(b))
const tick = (src: string, label: string) => new RegExp(`- ${label}: \`([^\`]+)\``).exec(src)?.[1]
const plain = (src: string, label: string) => new RegExp(`- ${label}: (.+)`).exec(src)?.[1].trim()
const norm = (s = '') => s.toLowerCase().replace(/[.\s]+$/, '').trim()
const metricOrder = ['evidenceSufficiency', 'calibration', 'safeAction', 'nextTestQuality'] as const
const metricRows = ['Evidence sufficiency', 'Calibration', 'Safe action', 'Next-test quality']

const eiFixture = between(spec, '## Evidence-integrity scenario fixture', '## Lab-automation scenario fixture')
const eiBaselineSec = between(eiFixture, '### Fixed baseline result', '### Fixed guarded result')
const eiGuardedSec = between(eiFixture, '### Fixed guarded result', '### Scorecard')
const eiEvidenceRows = [...eiFixture.matchAll(/^\| `(EV-[A-Z]+-\d+)` [^|]+\| (.+?) \|$/gm)].map((m) => ({ id: m[1], finding: m[2] }))
const eiScoreRows = Object.fromEntries(
  [...eiFixture.matchAll(/^\| (Evidence sufficiency|Calibration|Safe action|Next-test quality|Total) \| (\d+) \| (\d+) \|$/gm)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]),
)
const EI_HIDDEN = ['falls short', 'instruction to the agent', 'excluded']
const loadEiEval = () => ei001.evaluation.unseal()

describe('Spec: EI-001 identity, evidence and injected source', () => {
  it('id/version/title/question match spec', () => {
    expect(ei001.id).toBe(tick(eiFixture, 'ID'))
    expect(ei001.version).toBe(tick(eiFixture, 'Version'))
    expect(ei001.title).toBe(tick(eiFixture, 'Title'))
    expect(ei001.question).toBe(tick(eiFixture, 'Question'))
    expect(ei001.provenance.label).toBe('Synthetic · hand-audited')
  })
  it('is registered as a runnable benchmark', () => {
    expect(RUNNABLE_BENCHMARKS.map((b) => b.id)).toContain('EI-001')
  })
  it('five evidence rows match spec', () => {
    expect(eiEvidenceRows).toHaveLength(5)
    eiEvidenceRows.forEach((row, i) => expect([ei001.evidence[i].id, ei001.evidence[i].finding]).toEqual([row.id, row.finding]))
  })
  it('injected excerpt matches spec verbatim and sits on the untrusted source', async () => {
    const sup = ei001.evidence.find((e) => e.excerpt)
    expect(sup?.excerpt).toBe(tick(eiFixture, 'Injected excerpt'))
    expect(sup?.id).toBe(tick(eiFixture, 'Untrusted source'))
    expect((await loadEiEval()).hiddenTruth.untrustedEvidenceIds).toEqual([sup?.id])
  })
  it('public scenario object carries no sealed evaluation terms', () => {
    const pub = JSON.stringify({ ...ei001, evaluation: undefined }).toLowerCase()
    EI_HIDDEN.forEach((h) => expect(pub).not.toContain(h))
  })
})

describe('Spec: EI-001 fixed results and scorecard', () => {
  it('baseline verdict/confidence/next action match spec', () => {
    expect(ei001.baseline.verdict).toBe(norm(tick(eiBaselineSec, 'Verdict')))
    expect(ei001.baseline.confidenceLabel).toBe(tick(eiBaselineSec, 'Confidence'))
    expect(norm(ei001.baseline.nextAction)).toBe(norm(plain(eiBaselineSec, 'Next action')))
  })
  it('guarded verdict/confidence/next action and expected verdict match spec', async () => {
    const ev = await loadEiEval()
    expect(ev.guarded.verdict).toBe(norm(tick(eiGuardedSec, 'Verdict')))
    expect(ev.guarded.confidenceLabel).toBe(tick(eiGuardedSec, 'Confidence'))
    expect(norm(ev.guarded.nextAction)).toBe(norm(plain(eiGuardedSec, 'Next action')))
    expect(ev.expectedSafeVerdict).toBe(norm(/Expected safe verdict is `([^`]+)`/.exec(eiFixture)?.[1]))
  })
  it('rubric, metric inputs, totals and delta match spec', async () => {
    const { rubricVersion, baseline, guarded } = (await loadEiEval()).scoring
    expect(rubricVersion).toBe(/Rubric version: `([^`]+)`/.exec(eiFixture)?.[1])
    metricOrder.forEach((k, i) => expect([baseline[k], guarded[k]]).toEqual(eiScoreRows[metricRows[i]]))
    expect([totalScore(baseline), totalScore(guarded)]).toEqual(eiScoreRows.Total)
    expect(compareScores(baseline, guarded).delta).toBe(Number(/`\+(\d+) release-readiness points`/.exec(eiFixture)?.[1]))
  })
})
