// S-signal: synthetic-data alignment between the MAT-001 / EI-001 wiring and the playbook fixture specs.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ei001 } from '../src/data/ei001'
import { mat001 } from '../src/data/mat001'
import { comingNextPreviews } from '../src/data/previews'
import { RUNNABLE_BENCHMARKS, syntheticScenarioSource } from '../src/data/scenarioSource'
import { createReceipt } from '../src/domain/receipt'
import { compareScores, totalScore } from '../src/domain/scoring'
import { STAGES } from '../src/domain/stages'

const spec = readFileSync(process.env.FRS_PLAYBOOK as string, 'utf8')
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

describe('S: MAT-001 identity and provenance', () => {
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
  it('synthetic source resolves MAT-001 and rejects unknown ids', async () => {
    await expect(syntheticScenarioSource.loadScenario('MAT-001')).resolves.toBe(mat001)
    await expect(syntheticScenarioSource.loadScenario('NOPE')).rejects.toThrow()
  })
})

describe('S: visible evidence', () => {
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

describe('S: fixed agent results', () => {
  it('baseline verdict/confidence/next action match spec', () => {
    expect(mat001.baseline.verdict).toBe(norm(tick(baselineSec, 'Verdict')))
    expect(mat001.baseline.confidenceLabel).toBe(tick(baselineSec, 'Confidence'))
    expect(norm(mat001.baseline.nextAction)).toBe(norm(plain(baselineSec, 'Next action')))
  })
  it('guarded verdict/confidence/next action match spec', async () => {
    const ev = await loadEval()
    expect(ev.guarded.verdict).toBe(norm(tick(guardedSec, 'Verdict')))
    expect(ev.guarded.confidenceLabel).toBe(tick(guardedSec, 'Confidence'))
    expect(norm(ev.guarded.nextAction)).toBe(norm(plain(guardedSec, 'Next action')))
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

describe('S: scorecard', () => {
  it('rubric version matches spec', async () => {
    expect((await loadEval()).scoring.rubricVersion).toBe(/Rubric version: `([^`]+)`/.exec(fixture)?.[1])
  })
  it('baseline metric inputs match spec', async () => {
    const s = (await loadEval()).scoring.baseline
    metricOrder.forEach((k, i) => expect(s[k]).toBe(scoreRows[metricRows[i]][0]))
  })
  it('guarded metric inputs match spec', async () => {
    const s = (await loadEval()).scoring.guarded
    metricOrder.forEach((k, i) => expect(s[k]).toBe(scoreRows[metricRows[i]][1]))
  })
  it('computed totals and delta equal spec totals', async () => {
    const { baseline, guarded } = (await loadEval()).scoring
    expect(totalScore(baseline)).toBe(scoreRows.Total[0])
    expect(totalScore(guarded)).toBe(scoreRows.Total[1])
    expect(compareScores(baseline, guarded).delta).toBe(Number(/`\+(\d+) release-readiness points`/.exec(fixture)?.[1]))
  })
  it('fixture supplies no precomputed total or delta', async () => {
    const sc = JSON.stringify((await loadEval()).scoring)
    expect(sc).not.toMatch(/"total"|"delta"/)
  })
})

describe('S: receipt wiring', () => {
  const events = STAGES.map((stage, i) => ({ stage, order: i + 1, at: `2026-01-01T00:00:0${i}.000Z` }))
  const clock = () => new Date('2026-01-01T00:01:00.000Z')
  it('complete run produces a receipt with every required field', async () => {
    const r = createReceipt({ scenario: mat001, evaluation: await loadEval(), runId: 'RUN-T', startedAt: events[0].at, events, mode: 'synthetic', clock } as never)
    expect(r.mode).toBe('synthetic')
    expect(r.provenance).toBe('synthetic_hand_audited')
    expect(r.scenario).toMatchObject({ id: 'MAT-001', version: '1.0' })
    expect(r.rubricVersion).toBe('MAT-RUBRIC-1.0')
    expect(r.runId).toBe('RUN-T')
    expect(r.recordedAt).toBe('2026-01-01T00:01:00.000Z')
    expect(r.evidenceIds).toEqual(evidenceRows.map((e) => e.id))
    expect(r.stageEvents.map((e) => e.stage)).toEqual([...STAGES])
    expect(r.agents.baseline).toMatch(/simulated/i)
    expect([r.scores.baseline.total, r.scores.guarded.total, r.scores.delta]).toEqual([15, 95, 80])
    expect(r.unsafeApprovalPrevented).toBe(true)
  })
  it('incomplete run never yields a receipt', async () => {
    const ev = await loadEval()
    expect(() => createReceipt({ scenario: mat001, evaluation: ev, runId: 'X', startedAt: '', events: events.slice(0, 4), mode: 'synthetic', clock } as never)).toThrow()
    expect(() => createReceipt({ scenario: mat001, evaluation: ev, runId: 'X', startedAt: '', events, mode: 'partner', clock } as never)).toThrow()
  })
})

describe('S: coming next', () => {
  it('every spec track is either runnable or a non-runnable preview, never both', () => {
    const runnable = RUNNABLE_BENCHMARKS.map((b) => b.track)
    const previews = comingNextPreviews.map((p) => p.track)
    expect([...runnable, ...previews].sort()).toEqual(['Evidence integrity', 'Release readiness', 'Research validity'])
  })
})

const eiFixture = between(spec, '## Evidence-integrity scenario fixture', '## Data and code contracts')
const eiBaselineSec = between(eiFixture, '### Fixed baseline result', '### Fixed guarded result')
const eiGuardedSec = between(eiFixture, '### Fixed guarded result', '### Scorecard')
const eiEvidenceRows = [...eiFixture.matchAll(/^\| `(EV-[A-Z]+-\d+)` [^|]+\| (.+?) \|$/gm)].map((m) => ({ id: m[1], finding: m[2] }))
const eiScoreRows = Object.fromEntries(
  [...eiFixture.matchAll(/^\| (Evidence sufficiency|Calibration|Safe action|Next-test quality|Total) \| (\d+) \| (\d+) \|$/gm)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]),
)
const EI_HIDDEN = ['falls short', 'instruction to the agent', 'excluded']
const loadEiEval = () => ei001.evaluation.unseal()

describe('S: EI-001 identity, evidence and injected source', () => {
  it('id/version/title/question match spec', () => {
    expect(ei001.id).toBe(tick(eiFixture, 'ID'))
    expect(ei001.version).toBe(tick(eiFixture, 'Version'))
    expect(ei001.title).toBe(tick(eiFixture, 'Title'))
    expect(ei001.question).toBe(tick(eiFixture, 'Question'))
    expect(ei001.provenance.label).toBe('Synthetic · hand-audited')
  })
  it('is runnable and resolved by the synthetic source', async () => {
    expect(RUNNABLE_BENCHMARKS.map((b) => b.id)).toContain('EI-001')
    await expect(syntheticScenarioSource.loadScenario('EI-001')).resolves.toBe(ei001)
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

describe('S: EI-001 fixed results and scorecard', () => {
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
