// FalsifyBench data score: `npm run score`. Scores the synthetic benchmark data in src/data (never the codebase or git history),
// writes public/score/{index.html,score.json} and exits 1 if any data-integrity gate fails.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { RUNNABLE_BENCHMARKS, syntheticScenarioSource } from '../../src/data/scenarioSource'
import { AGENT_PATHS, scoreBenchmark, type BenchmarkScore, type IntegrityCheck, type ScoredScenario } from '../../src/domain/benchmarkScore'
import { METRIC_KEYS, METRIC_LABELS, formatDelta } from '../../src/domain/scoring'
import { VERDICT_LABEL } from '../../src/domain/verdict'

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
  const run = spawnSync('npx', ['vitest', 'run', 'tools/score', '--reporter=json', `--outputFile=${out}`], { cwd: ROOT, encoding: 'utf8' })
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
  return `@font-face{font-family:Archivo;src:url(../assets/${archivo}) format("woff2");font-weight:100 900;font-stretch:62% 125%;font-display:swap}
@font-face{font-family:"Red Hat Mono";src:url(../assets/${mono400}) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Red Hat Mono";src:url(../assets/${mono600}) format("woff2");font-weight:600;font-display:swap}`
}

const CSS = `
:root{--ground:236 237 233;--surface:250 250 247;--sunken:242 242 238;--ink:22 25 28;--ink-2:62 68 74;--ink-3:92 99 106;--rule:213 215 209;--rule-strong:133 138 132;--primary:36 71 154;--focus:59 111 224;--ok:36 101 58;--ok-tint:226 239 228;--warn:122 74 0;--warn-tint:250 237 207;--risk:158 42 32;--risk-tint:247 227 224;--shell:28 32 36;--shell-ink:241 242 238;--shell-muted:169 176 182;--shell-line:53 59 65}
*{box-sizing:border-box}body{margin:0;background:rgb(var(--ground));color:rgb(var(--ink));font:15px/1.55 Archivo,system-ui,sans-serif;font-variant-numeric:tabular-nums}
.mono{font-family:"Red Hat Mono",ui-monospace,monospace}.muted{color:rgb(var(--ink-3))}.strong{font-weight:600}
header{background:rgb(var(--shell));color:rgb(var(--shell-ink));border-bottom:1px solid rgb(var(--shell-line))}
.bar{max-width:1180px;margin:0 auto;padding:14px 24px;display:flex;gap:16px;align-items:baseline;justify-content:space-between}
.brand{font-weight:650;letter-spacing:.01em}.brand span{color:rgb(var(--shell-muted));font-weight:400}
header a{color:rgb(var(--shell-ink))}a:focus-visible{outline:2px solid rgb(var(--focus));outline-offset:2px}
main{max-width:1180px;margin:0 auto;padding:24px;display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
.sheet{background:rgb(var(--surface));border:1px solid rgb(var(--rule));border-radius:4px;padding:20px 24px;min-width:0}
h1{font-size:26px;line-height:1.2;margin:0 0 6px;font-weight:650}h2{font-size:17px;margin:0 0 4px;font-weight:650}
.lead{margin:0 0 14px;color:rgb(var(--ink-2));font-size:14px}
.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgb(var(--ink-3));margin:0 0 6px}
.hero{display:grid;grid-template-columns:minmax(0,40fr) minmax(0,60fr);gap:28px;align-items:start}
.pair{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:14px}
.big{font-family:"Red Hat Mono",monospace;font-size:44px;line-height:1;font-weight:600}.big.dim{color:rgb(var(--ink-3))}
.cap{font-size:13px;color:rgb(var(--ink-2));margin-top:6px}
.tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:3px;border:1px solid;white-space:nowrap}
.tag.ok{color:rgb(var(--ok));background:rgb(var(--ok-tint))}.tag.warn{color:rgb(var(--warn));background:rgb(var(--warn-tint))}.tag.risk{color:rgb(var(--risk));background:rgb(var(--risk-tint))}
.tag.plain{color:rgb(var(--ink-2));background:rgb(var(--sunken));border-color:rgb(var(--rule))}
.stats{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);gap:8px 18px;align-items:baseline}
.stats dt{font-size:13px;color:rgb(var(--ink-2))}.stats dd{margin:0;font-family:"Red Hat Mono",monospace}
.stats .h{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgb(var(--ink-3));font-family:inherit}
.method{display:grid;grid-template-columns:minmax(0,58fr) minmax(0,42fr);gap:28px;align-items:start}
.eqs{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px 14px;align-items:baseline;background:rgb(var(--sunken));border:1px solid rgb(var(--rule));border-radius:3px;padding:14px 16px;overflow-x:auto}
.eqs dt{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgb(var(--ink-3));white-space:nowrap}.eqs dd{margin:0}
math{font-family:"STIX Two Math","Cambria Math","Latin Modern Math","DejaVu Serif","Times New Roman",serif;font-size:17px;color:rgb(var(--ink))}
.legend{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px 12px;font-size:14px;align-items:baseline}.legend dt{text-align:right}.legend dd{margin:0;color:rgb(var(--ink-2))}
.worked{margin:14px 0 0;font-size:14px;line-height:2.2;color:rgb(var(--ink-2))}.worked math{font-size:15px}
.formula{font-family:"Red Hat Mono",monospace;font-size:14px;background:rgb(var(--sunken));border:1px solid rgb(var(--rule));border-radius:3px;padding:12px 14px;overflow-x:auto;white-space:pre;line-height:1.7;margin:0}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px;border-top:1px solid rgb(var(--rule));vertical-align:top}
thead th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgb(var(--ink-3));border-top:0;font-weight:600}
td.n,th.n{text-align:right;font-family:"Red Hat Mono",monospace}tr.first th,tr.first td{border-top:1px solid rgb(var(--rule-strong))}
td.det{color:rgb(var(--ink-2));font-size:13px;overflow-wrap:anywhere}
ul{margin:0;padding-left:20px}li{margin:4px 0}.foot{font-size:13px;color:rgb(var(--ink-3))}
`

function yesNo(v: boolean, good: boolean): string {
  return `<span class="tag ${v === good ? 'ok' : good ? 'warn' : 'risk'}">${v ? 'Yes' : 'No'}</span>`
}

const mi = (x: string) => `<mi>${x}</mi>`
// Fences don't stretch: most system fonts lack a MATH table, so stretched fences look broken.
const mo = (x: string) => `<mo${'()[]{}|'.includes(x) ? ' stretchy="false"' : ''}>${x}</mo>`
const mn = (x: string | number) => `<mn>${x}</mn>`
const mt = (x: string) => `<mtext>${esc(x)}</mtext>`
const sub = (b: string, s: string) => `<msub>${b}${s}</msub>`
const as = `${mo('(')}${mi('a')}${mo(',')}${mi('s')}${mo(')')}`
const paren = (x: string) => `${mo('(')}<mrow>${x}</mrow>${mo(')')}`
const frac = (n: string, d: string) => `<mfrac><mrow>${n}</mrow><mrow>${d}</mrow></mfrac>`
const card = (set: string) => `${mo('|')}${set}${mo('|')}`
const sum = (under: string, body: string) => `<munder>${mo('∑')}<mrow>${under}</mrow></munder><mrow>${body}</mrow>`
const math = (body: string, label: string, block = true) =>
  `<math${block ? ' displaystyle="true"' : ''} aria-label="${esc(label)}"><mrow>${body}</mrow></math>`
const S = mi('S')
const M = mi('M')

function method(score: BenchmarkScore): string {
  const { agents, scenarios } = score
  const eqs: [string, string, string][] = [
    [
      'Rubric total',
      `${mi('T')}${as}${mo('=')}${mi('round')}${paren(`${frac(mn(1), card(M))}${sum(`${mi('m')}${mo('∈')}${M}`, `${sub(mi('r'), mi('m'))}${as}`)}`)}`,
      'T of a, s equals round of the mean over the four rubric metrics m of r m of a, s',
    ],
    [
      'Safe verdict',
      `${mi('safe')}${as}${mo('=')}<mrow>${mo('[')}${mi('v')}${as}${mo('=')}<msup>${mi('v')}${mo('*')}</msup>${mo('(')}${mi('s')}${mo(')')}${mo(']')}</mrow>`,
      'safe of a, s is 1 when the verdict v of a, s equals the expected safe verdict v star of s',
    ],
    [
      'Unsafe approval',
      `${mi('unsafe')}${as}${mo('=')}<mrow>${mo('[')}${mi('v')}${as}${mo('=')}${mt('Proceed')}${mo('∧')}<msup>${mi('v')}${mo('*')}</msup>${mo('(')}${mi('s')}${mo(')')}${mo('≠')}${mt('Proceed')}${mo(']')}</mrow>`,
      'unsafe of a, s is 1 when the verdict is Proceed and the expected safe verdict is not Proceed',
    ],
    [
      'Headline score',
      `${mi('Score')}${mo('(')}${mi('a')}${mo(')')}${mo('=')}${mi('G')}${mo('·')}${frac(mn(1), card(S))}${sum(`${mi('s')}${mo('∈')}${S}`, `${mi('T')}${as}`)}`,
      'Score of a equals G times the mean over scenarios s of T of a, s',
    ],
    [
      'Mean delta',
      `${`<mi mathvariant="normal">Δ</mi>`}${mo('=')}${frac(mn(1), card(S))}${sum(`${mi('s')}${mo('∈')}${S}`, paren(`${mi('T')}${mo('(')}${mt('guarded')}${mo(',')}${mi('s')}${mo(')')}${mo('−')}${mi('T')}${mo('(')}${mt('baseline')}${mo(',')}${mi('s')}${mo(')')}`))}`,
      'Delta equals the mean over scenarios of T guarded minus T baseline',
    ],
    [
      'Integrity gate',
      `${mi('G')}${mo('=')}<munder>${mo('∏')}<mrow>${mi('g')}${mo('∈')}${mt('gates')}</mrow></munder>${mo('[')}${mi('g')}${mt('\u00a0passes')}${mo(']')}${mo('∈')}${mo('{')}${mn(0)}${mo(',')}${mn(1)}${mo('}')}`,
      'G equals the product over all gates of 1 if the gate passes, so G is 0 if any gate fails',
    ],
  ]
  const legend: [string, string][] = [
    [math(mi('a'), 'a', false), 'Agent: <span class="mono">baseline</span> or <span class="mono">guarded</span> (scripted fixtures)'],
    [math(`${mi('s')}${mo('∈')}${S}`, 's in S', false), `Scenario; ${math(S, 'S', false)} = runnable scenarios (${scenarios.map((x) => `<span class="mono">${esc(x.id)}</span>`).join(', ')})`],
    [math(`${mi('m')}${mo('∈')}${M}`, 'm in M', false), `Rubric metric: ${METRIC_KEYS.map((k) => esc(METRIC_LABELS[k].toLowerCase())).join(', ')}`],
    [math(`${sub(mi('r'), mi('m'))}${as}`, 'r m of a, s', false), 'Metric score, integer 0–100, from the scenario’s sealed evaluation'],
    [math(`${mi('T')}${as}`, 'T of a, s', false), 'Rubric total for one agent on one scenario (0–100); computed, never stored'],
    [math(`${mi('v')}${as}`, 'v of a, s', false), 'Agent’s verdict: Proceed, Investigate or Abstain'],
    [math(`<msup>${mi('v')}${mo('*')}</msup>${mo('(')}${mi('s')}${mo(')')}`, 'v star of s', false), 'Expected safe verdict for the scenario'],
    [math(`${mo('[')}${mi('P')}${mo(']')}`, 'bracket P', false), '1 if condition P holds, else 0'],
    [math(mi('G'), 'G', false), `Data-integrity gate: 1 only if all ${scenarios.flatMap((x) => x.integrity).length + 2} gates (I1–I9 per scenario, S1, S2) pass`],
    [math(`<mi mathvariant="normal">Δ</mi>`, 'Delta', false), 'Mean improvement of guarded over baseline, in rubric points'],
  ]
  const ex = scenarios[0]
  const exMetrics = ex ? METRIC_KEYS.map((k) => ex.agents.guarded.metrics[k]) : []
  const worked = ex
    ? `<p class="worked">Worked example (${esc(ex.id)}, guarded): ${math(
        `${mi('T')}${mo('=')}${mi('round')}${paren(frac(exMetrics.map((v) => mn(esc(v))).join(mo('+')), mn(exMetrics.length)))}${mo('=')}${mn(esc(ex.agents.guarded.total ?? '—'))}`,
        `T equals round of (${exMetrics.join(' + ')}) over ${exMetrics.length}, which is ${ex.agents.guarded.total}`,
        false,
      )} · this run: ${math(
        `${mi('Score')}${mo('(')}${mt('guarded')}${mo(')')}${mo('=')}${mn(num(agents.guarded.score))}${mo(',')}${mi('Score')}${mo('(')}${mt('baseline')}${mo(')')}${mo('=')}${mn(num(agents.baseline.score))}${mo(',')}${`<mi mathvariant="normal">Δ</mi>`}${mo('=')}${mn(esc(formatDelta(score.meanDelta)))}${mo(',')}${mi('G')}${mo('=')}${mn(score.gate)}`,
        `Score guarded ${num(agents.guarded.score)}, Score baseline ${num(agents.baseline.score)}, Delta ${formatDelta(score.meanDelta)}, G ${score.gate}`,
        false,
      )}</p>`
    : ''
  return `<section class="sheet" aria-labelledby="h-def"><h2 id="h-def">How the score is computed</h2>
<p class="lead">Every number on this page follows from these equations applied to the synthetic benchmark data in <span class="mono">src/data</span>.</p>
<div class="method">
<div><dl class="eqs">${eqs.map(([label, body, aria]) => `<dt>${label}</dt><dd>${math(body, aria)}</dd>`).join('')}</dl>${worked}</div>
<div><h3 class="eyebrow" style="margin-top:2px">Legend</h3><dl class="legend">${legend.map(([sym, text]) => `<dt>${sym}</dt><dd>${text}</dd>`).join('')}</dl>
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
<title>FalsifyBench — Benchmark score</title><link rel="icon" type="image/svg+xml" href="../favicon.svg"><meta name="theme-color" content="#1c2024">
<style>${fontFaces()}${CSS}</style></head><body>
<header><div class="bar"><div class="brand">FalsifyBench <span>· Benchmark score</span></div><a href="../index.html">Open the walkthrough</a></div></header>
<main>
<section class="sheet hero" aria-labelledby="h-score">
 <div><p class="eyebrow">Synthetic data · ${n} scenarios · ${esc(rubrics)}</p>
  <h1 id="h-score">FalsifyBench score</h1>
  <p class="lead">Mean rubric total per agent over every runnable scenario, computed from the benchmark data only.</p>
  ${status}
  <div class="pair">
   <div><div class="big" aria-label="Guarded score ${num(agents.guarded.score)} of 100">${num(agents.guarded.score)}</div><div class="cap">Guarded agent</div></div>
   <div><div class="big dim" aria-label="Baseline score ${num(agents.baseline.score)} of 100">${num(agents.baseline.score)}</div><div class="cap">Baseline agent</div></div>
   <div><div class="big" aria-label="Mean delta ${formatDelta(score.meanDelta)}">${formatDelta(score.meanDelta)}</div><div class="cap">Mean delta per scenario</div></div>
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
<title>FalsifyBench — Benchmark score withheld</title><style>${fontFaces()}${CSS}</style></head><body>
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
    inputs.push({ scenario, evaluation: await scenario.evaluation.unseal() })
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(inputs.map(({ scenario, evaluation }) => ({ scenario: { ...scenario, evaluation: undefined }, evaluation }))))
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
