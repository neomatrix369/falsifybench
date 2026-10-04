// FalsifyBench data score: `npm run score`. Scores the synthetic benchmark data in src/data (never the codebase or git history),
// writes public/score/{index.html,score.json} and exits 1 if any data-integrity gate fails.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { RUNNABLE_BENCHMARKS, syntheticScenarioSource } from '../../src/data/scenarioSource'
import { scriptedAgentRunner } from '../../src/data/scriptedAgentRunner'
import { gradeRun, runAgents } from '../../src/domain/agentRun'
import { fixtureGrader } from '../../src/domain/fixtureGrader'
import { AGENT_PATHS, scoreBenchmark, type BenchmarkScore, type IntegrityCheck, type ScoredScenario } from '../../src/domain/benchmarkScore'
import { METRIC_KEYS, METRIC_LABELS, formatDelta } from '../../src/domain/scoring'
import { SCORE_EQUATIONS, scoreLegend, workedRun, workedTotal } from '../../src/domain/scoreMath'
import { VERDICT_LABEL } from '../../src/domain/verdict'
import { ARCHIVO, SCORE_CSS, token } from './style'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = `${ROOT}public/score/`
const WORK = `${ROOT}.score/`
// Sealed terms that must never reach a published page (also enforced by the spec checks for each scenario's public fixture).
const SEALED_TERMS = ['highest-stress', 'zero ultrasonic', 'falls short', 'instruction to the agent']

const esc = (v: unknown) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const pct = (x: number) => `${Math.round(x * 100)}%`
const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1))

/** Spec file for a scenario ID, e.g. MAT-001 → tools/score/spec.mat001.test.ts. */
const specFile = (id: string) => `tools/score/spec.${id.toLowerCase().replace(/[^a-z0-9]/g, '')}.test.ts`

function specGate(ids: readonly string[]): IntegrityCheck {
  const fail = (detail: string): IntegrityCheck => ({ id: 'S1', label: 'Data matches the playbook spec', ok: false, detail })
  const missing = ids.filter((id) => !existsSync(`${ROOT}${specFile(id)}`))
  if (missing.length) return fail(`no spec checks for ${missing.join(', ')} (expected ${missing.map(specFile).join(', ')})`)
  mkdirSync(WORK, { recursive: true })
  const out = `${WORK}spec.json`
  rmSync(out, { force: true })
  const run = spawnSync('npx', ['vitest', 'run', 'tools/score/spec.', '--reporter=json', `--outputFile=${out}`], { cwd: ROOT, encoding: 'utf8' })
  if (!existsSync(out)) return fail(`spec checks did not run (exit ${run.status ?? run.signal})`)
  const r = JSON.parse(readFileSync(out, 'utf8')) as {
    numPassedTests: number
    numTotalTests: number
    testResults: { name: string; assertionResults: { title: string; status: string }[] }[]
  }
  const failed = r.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status !== 'passed').map((a) => a.title))
  const ran = new Set(r.testResults.filter((f) => f.assertionResults.length > 0).map((f) => f.name.slice(ROOT.length)))
  const unrun = ids.filter((id) => !ran.has(specFile(id)))
  return {
    id: 'S1',
    label: 'Data matches the playbook spec',
    ok: run.status === 0 && r.numTotalTests > 0 && failed.length === 0 && unrun.length === 0,
    detail: `${r.numPassedTests}/${r.numTotalTests} fixture-vs-playbook checks pass${failed.length ? `; failing: ${failed.slice(0, 3).join('; ')}` : ''}${unrun.length ? `; no checks ran for ${unrun.join(', ')}` : ''}`,
  }
}

/** Hashes the data in the layout it had before guarded/scoring left the evaluation, so the published fingerprint only moves when the data does. */
function fingerprintShape({ scenario, evaluation, run }: ScoredScenario) {
  const { hiddenTruth, narrative, findings, expectedSafeVerdict, sufficientNextAction, ...rest } = evaluation
  return {
    scenario: { ...scenario, evaluation: undefined },
    evaluation: { hiddenTruth, narrative, findings, expectedSafeVerdict, sufficientNextAction, guarded: run.responses.guarded, ...rest, scoring: run.scores },
  }
}

function sealedText(inputs: ScoredScenario[]): string[] {
  return [
    ...SEALED_TERMS,
    ...inputs.flatMap(({ evaluation: e }) => [e.hiddenTruth.summary, ...e.findings.map((f) => f.statement), ...Object.values(e.narrative)]),
  ].map((s) => s.toLowerCase())
}

function fontFaces(): string {
  const dir = `${ROOT}dist/assets/`
  const files = existsSync(dir) ? readdirSync(dir) : []
  const find = (prefix: string, fallback: string) => files.find((f) => f.startsWith(prefix) && f.endsWith('.woff2')) ?? fallback
  const archivo = find('archivo-latin-wdth-normal-', 'archivo-latin-wdth-normal-DY7AcnAa.woff2')
  const mono400 = find('red-hat-mono-latin-400-normal-', 'red-hat-mono-latin-400-normal-C-lyubUB.woff2')
  const mono600 = find('red-hat-mono-latin-600-normal-', 'red-hat-mono-latin-600-normal-BElMyFjl.woff2')
  return `@font-face{font-family:${ARCHIVO};src:url(../assets/${archivo}) format("woff2");font-weight:100 900;font-stretch:62% 125%;font-display:swap}
@font-face{font-family:"Red Hat Mono";src:url(../assets/${mono400}) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Red Hat Mono";src:url(../assets/${mono600}) format("woff2");font-weight:600;font-display:swap}`
}


function yesNo(v: boolean, good: boolean): string {
  return `<span class="tag ${v === good ? 'ok' : good ? 'warn' : 'risk'}">${v ? 'Yes' : 'No'}</span>`
}

function method(score: BenchmarkScore): string {
  const { agents, scenarios } = score
  const legend = scoreLegend({
    scenarios: scenarios.map((x) => x.id),
    gateCount: scenarios.flatMap((x) => x.integrity).length + 2,
    metricLabels: METRIC_KEYS.map((k) => METRIC_LABELS[k]),
  })
  const ex = scenarios[0]
  const worked = ex
    ? `<p class="worked">Worked example (${esc(ex.id)}): ${workedTotal('guarded', METRIC_KEYS.map((k) => ex.agents.guarded.metrics[k]), ex.agents.guarded.total ?? '—')} · this run: ${workedRun(num(agents.guarded.score), num(agents.baseline.score), formatDelta(score.meanDelta), score.gate)}</p>`
    : ''
  return `<section class="sheet" aria-labelledby="h-def"><h2 id="h-def">How the score is computed</h2>
<p class="lead">Every number on this page follows from these equations applied to the synthetic benchmark data in <span class="mono">src/data</span>.</p>
<div class="method">
<div><dl class="eqs">${SCORE_EQUATIONS.map((e) => `<dt>${esc(e.label)}</dt><dd>${e.mathml}</dd>`).join('')}</dl>${worked}</div>
<div><h3 class="label" style="margin-top:2px">Legend</h3><dl class="legend">${legend.map((l) => `<dt>${l.symbol}</dt><dd>${esc(l.text)}</dd>`).join('')}</dl>
<ul class="foot" style="margin-top:14px">
<li>Not measured: code quality, tests, bundle size or commit history. Those are development checks (<span class="mono">npm run lint</span>, <span class="mono">npm test</span>, <span class="mono">npm run build</span>, <span class="mono">tools/qa/acceptance.py</span>) and do not change this score.</li>
<li>Agents are scripted fixtures; no model, partner data or network call is involved.</li>
</ul></div>
</div></section>`
}

function render(score: BenchmarkScore, extra: IntegrityCheck[], fingerprint: string): string {
  const { agents, scenarios } = score
  const gates = scenarios.flatMap((s) => s.integrity).length + extra.length
  const status = score.gate
    ? `<span class="tag ok">All ${gates} data-integrity gates pass</span>`
    : `<span class="tag risk">Not scored: ${score.failedGates.length} of ${gates} data-integrity gates fail</span>`
  const rubrics = [...new Set(scenarios.map((s) => s.rubricVersion))].join(', ')
  const rows = scenarios
    .map((s) =>
      AGENT_PATHS.map((p, i) => {
        const a = s.agents[p]
        return `<tr${i === 0 ? ' class="first"' : ''}>${i === 0 ? `<th scope="rowgroup" rowspan="2"><span class="mono">${esc(s.id)}</span> <span class="muted">v${esc(s.version)}</span><br><span class="muted">${esc(s.title)}</span></th>` : ''}
<td>${p === 'baseline' ? 'Baseline' : 'Guarded'}<br><span class="muted">${esc(a.agentLabel)}</span></td>
<td>${esc(VERDICT_LABEL[a.verdict] ?? a.verdict)}</td><td>${esc(VERDICT_LABEL[s.expectedSafeVerdict] ?? s.expectedSafeVerdict)}</td><td>${yesNo(a.safeVerdict, true)}</td><td>${yesNo(a.unsafeApproval, false)}</td>
${METRIC_KEYS.map((k) => `<td class="n">${esc(a.metrics[k])}</td>`).join('')}<td class="n strong">${esc(a.total ?? '—')}</td>
${i === 0 ? `<td class="n" rowspan="2">${s.delta === null ? '—' : formatDelta(s.delta)}</td>` : ''}</tr>`
      }).join(''),
    )
    .join('')
  const gateRows =
    scenarios[0]?.integrity
      .map(
        (c, ci) => `<tr><th scope="row"><span class="mono">${esc(c.id)}</span> ${esc(c.label)}</th>${scenarios
          .map((s) => {
            const r = s.integrity[ci]
            return `<td>${r.ok ? '<span class="tag ok">Pass</span>' : '<span class="tag risk">Fail</span>'}<div class="det">${esc(r.detail)}</div></td>`
          })
          .join('')}</tr>`,
      )
      .join('') ?? ''
  const extraRows = extra
    .map(
      (c) => `<tr><th scope="row"><span class="mono">${esc(c.id)}</span> ${esc(c.label)}</th><td colspan="${scenarios.length}">${c.ok ? '<span class="tag ok">Pass</span>' : '<span class="tag risk">Fail</span>'}<div class="det">${esc(c.detail)}</div></td></tr>`,
    )
    .join('')
  const stat = (label: string, b: string, g: string) => `<dt>${label}</dt><dd>${b}</dd><dd>${g}</dd>`
  const n = scenarios.length

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FalsifyBench — Benchmark score</title><link rel="icon" type="image/svg+xml" href="../favicon.svg"><meta name="theme-color" content="${token('shell')}">
<style>${fontFaces()}${SCORE_CSS}</style></head><body>
<header><div class="bar"><div class="brand">FalsifyBench <span>· Benchmark score</span></div><a href="../index.html">Open the walkthrough</a></div></header>
<main>
<section class="sheet hero" aria-labelledby="h-score">
 <div><h1 id="h-score">FalsifyBench score</h1>
  <p class="lead">Mean rubric total per agent over every runnable scenario, computed from the benchmark data only.</p>
  <p class="meta">Synthetic data · ${n} scenarios · <span class="mono">${esc(rubrics)}</span></p>
  ${status}
  <div class="pair">
   <div><div class="big" aria-label="Guarded score ${num(agents.guarded.score)} of 100">${num(agents.guarded.score)}</div><div class="cap">Guarded agent</div></div>
   <div><div class="big dim" aria-label="Baseline score ${num(agents.baseline.score)} of 100">${num(agents.baseline.score)}</div><div class="cap">Baseline agent</div></div>
   <div><div class="big delta" aria-label="Mean delta ${formatDelta(score.meanDelta)}">${formatDelta(score.meanDelta)}</div><div class="cap">Mean delta per scenario</div></div>
  </div></div>
 <dl class="stats" aria-label="Per-agent results">
  <dt class="h">Across ${n} scenarios</dt><dd class="h">Baseline</dd><dd class="h">Guarded</dd>
  ${stat('Safe verdict (matches expected)', `${agents.baseline.safeVerdicts}/${n} · ${pct(agents.baseline.safeVerdictRate)}`, `${agents.guarded.safeVerdicts}/${n} · ${pct(agents.guarded.safeVerdictRate)}`)}
  ${stat('Unsafe approval (Proceed when unsafe)', `${agents.baseline.unsafeApprovals}/${n} · ${pct(agents.baseline.unsafeApprovalRate)}`, `${agents.guarded.unsafeApprovals}/${n} · ${pct(agents.guarded.unsafeApprovalRate)}`)}
  ${stat('Mean rubric total (0–100)', num(agents.baseline.meanTotal), num(agents.guarded.meanTotal))}
  <dt>Unsafe approvals prevented</dt><dd></dd><dd>${score.unsafeApprovalsPrevented}/${n}</dd>
 </dl>
</section>
${method(score)}
<section class="sheet" aria-labelledby="h-res"><h2 id="h-res">Results by scenario and agent</h2>
<p class="lead">Each row is one agent's fixed response on one synthetic scenario, graded against that scenario's sealed evaluation.</p>
<div class="wrap"><table><thead><tr><th scope="col">Scenario</th><th scope="col">Agent</th><th scope="col">Verdict</th><th scope="col">Expected safe</th><th scope="col">Safe verdict</th><th scope="col">Unsafe approval</th>
${METRIC_KEYS.map((k) => `<th scope="col" class="n">${METRIC_LABELS[k]}</th>`).join('')}<th scope="col" class="n">Total</th><th scope="col" class="n">Delta</th></tr></thead>
<tbody>${rows}</tbody></table></div></section>
<section class="sheet" aria-labelledby="h-gates"><h2 id="h-gates">Data-integrity gates</h2>
<p class="lead">The score is reported only if every gate passes on every scenario (G = 1). One failure sets G = 0.</p>
<div class="wrap"><table><thead><tr><th scope="col">Gate</th>${scenarios.map((s) => `<th scope="col"><span class="mono">${esc(s.id)}</span></th>`).join('')}</tr></thead>
<tbody>${gateRows}${extraRows}</tbody></table></div></section>
<p class="foot">Generated by <span class="mono">npm run score</span> · data fingerprint <span class="mono">sha256:${fingerprint}</span> · raw results in <a href="score.json">score.json</a></p>
</main></body></html>
`
}

function withheld(gate: IntegrityCheck): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FalsifyBench — Benchmark score withheld</title><style>${fontFaces()}${SCORE_CSS}</style></head><body>
<header><div class="bar"><div class="brand">FalsifyBench <span>· Benchmark score</span></div><a href="../index.html">Open the walkthrough</a></div></header>
<main><section class="sheet" aria-labelledby="h-score"><h1 id="h-score">Score withheld</h1>
<p class="lead">Not scored (G = 0). Results are not published because gate <span class="mono">${esc(gate.id)}</span> (${esc(gate.label)}) failed: ${esc(gate.detail)}.</p></section></main></body></html>
`
}

async function main() {
  const ids = RUNNABLE_BENCHMARKS.map((b) => b.id)
  const inputs: ScoredScenario[] = []
  for (const id of ids) {
    const scenario = await syntheticScenarioSource.loadScenario(id)
    const evaluation = await scenario.evaluation.unseal()
    const run = gradeRun(fixtureGrader, scenario, evaluation, await runAgents(scriptedAgentRunner, scenario))
    inputs.push({ scenario, evaluation, run })
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(inputs.map(fingerprintShape)))
    .digest('hex')
    .slice(0, 12)

  const s1 = specGate(ids)
  const draftScore = scoreBenchmark(inputs, ids, [s1])
  const draft = (render(draftScore, [s1], fingerprint) + JSON.stringify(draftScore)).toLowerCase()
  const leaked = sealedText(inputs).filter((t) => draft.includes(t))
  const s2: IntegrityCheck = {
    id: 'S2',
    label: 'Sealed truth absent from the published score',
    ok: leaked.length === 0,
    detail: leaked.length ? `${leaked.length} sealed strings would be published` : `${sealedText(inputs).length} sealed strings checked`,
  }
  const extra = [s1, s2]
  const score = scoreBenchmark(inputs, ids, extra)

  mkdirSync(OUT, { recursive: true })
  if (!s2.ok) {
    // Never publish scenario values that would expose sealed truth; publish only the failed gate.
    writeFileSync(`${OUT}index.html`, withheld(s2))
    writeFileSync(`${OUT}score.json`, `${JSON.stringify({ fingerprint: `sha256:${fingerprint}`, gate: 0, failedGates: score.failedGates, withheld: true }, null, 2)}\n`)
    console.error(`FalsifyBench score withheld: ${s2.id} ${s2.label} failed (${s2.detail})`)
    process.exit(1)
  }
  writeFileSync(`${OUT}index.html`, render(score, extra, fingerprint))
  const json = {
    fingerprint: `sha256:${fingerprint}`,
    gate: score.gate,
    failedGates: score.failedGates,
    agents: score.agents,
    meanDelta: score.meanDelta,
    unsafeApprovalsPrevented: score.unsafeApprovalsPrevented,
    scenarios: score.scenarios,
    benchmarkGates: extra,
  }
  writeFileSync(`${OUT}score.json`, `${JSON.stringify(json, null, 2)}\n`)

  const { baseline: b, guarded: g } = score.agents
  console.log(`FalsifyBench score (synthetic data, ${score.scenarios.length} scenarios, sha256:${fingerprint})`)
  for (const s of score.scenarios) {
    console.log(`  ${s.id.padEnd(8)} baseline ${String(s.agents.baseline.total).padStart(3)} (${s.agents.baseline.verdict})  guarded ${String(s.agents.guarded.total).padStart(3)} (${s.agents.guarded.verdict})  delta ${s.delta === null ? '—' : formatDelta(s.delta)}  expected ${s.expectedSafeVerdict}`)
  }
  console.log(`  Score: guarded ${num(g.score)}, baseline ${num(b.score)}, mean delta ${formatDelta(score.meanDelta)}`)
  console.log(`  Safe verdicts: guarded ${g.safeVerdicts}/${g.scenarios}, baseline ${b.safeVerdicts}/${b.scenarios} · unsafe approvals: guarded ${g.unsafeApprovals}, baseline ${b.unsafeApprovals}`)
  console.log(score.gate ? '  Gates: all pass (G = 1)' : `  Gates FAILED (G = 0): ${score.failedGates.join('; ')}`)
  console.log(`  Wrote public/score/index.html and public/score/score.json`)
  process.exit(score.gate ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
