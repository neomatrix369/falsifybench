import json, html
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RES = os.path.join(ROOT, '.frs', 'results')
R = {k: json.load(open(os.path.join(RES, f'{k}.json'))) for k in ['0975cca-initial-poc','65cbf40-review-fixes','2219a0f-redesign','main','main+eager-leak','main+ei-eager-leak','main+score-drift']}
NAMES = {'0975cca-initial-poc':('0975cca','Initial PoC'),'65cbf40-review-fixes':('65cbf40','Review + QA fixes'),
         '2219a0f-redesign':('2219a0f','Design-system redesign'),'main':(None,'main · MAT-001 + EI-001'),
         'main+eager-leak':(None,'Mutation: MAT-001 evaluation bundled eagerly'),
         'main+ei-eager-leak':(None,'Mutation: EI-001 evaluation bundled eagerly'),
         'main+score-drift':(None,'Mutation: guarded score drifts from spec')}
NOTES = {'0975cca-initial-poc':'Unit test runner crashed on Node 20 (jsdom 30), so unit tests and coverage could not run (C = 0). Fixture checks pass. Fixed in 65cbf40.',
         '65cbf40-review-fixes':'Raw Tailwind palette in every component (0/16 token-conformant). Keyboard focus lost at Audit.',
         '2219a0f-redesign':'Tokens fixed (16/16). Keyboard focus still lost at Audit, caught only in real Chrome.',
         'main':'All 60 browser checks pass on both benchmarks, including the EI-001 injected line at every stage. Lowest sub-score is branch coverage.',
         'main+eager-leak':'MAT-001 sealed evaluation imported statically, so the hidden truth lands in the main bundle. Gate G = 0.',
         'main+ei-eager-leak':'EI-001 sealed evaluation imported statically, so its audit truth lands in the main bundle. Gate G = 0.',
         'main+score-drift':'Guarded safe-action score 100 → 60, so the shown result contradicts the spec. 3 fixture and 3 browser checks fail; fixture gate G = 0.'}
DEC = {'SHIP':'ok','SHIP-WITH-FIX-FORWARD':'warn','BLOCK':'risk'}
m = R['main']; s = m['signals']; c = m['components']
LABEL = {'SHIP':'Ship','SHIP-WITH-FIX-FORWARD':'Ship with fix-forward','BLOCK':'Block'}
failed = [k for k, v in m['gates'].items() if not v]
gate_line = f'All {len(m["gates"])} gates pass.' if not failed else 'Failed gates: ' + ', '.join(failed) + '.'
def pct(x): return f'{x*100:.1f}%'
least = ', '.join(f'{os.path.basename(f)} ({v["branches"]:g}%)' for f, v in sorted(s['coverage_by_file'].items(), key=lambda kv: kv[1]['branches'])[:4])
def bar(k, v, label, detail):
    return f'''<div class="sub"><div class="subhead"><span class="k">{k}</span><span class="lbl">{label}</span><span class="v">{v:.3f}</span></div>
<div class="track" role="img" aria-label="{label} {v:.3f} of 1"><div class="fill" style="width:{v*100:.1f}%"></div></div><p class="det">{detail}</p></div>'''
rows = ''
for key,(sha,name) in NAMES.items():
    r = R[key]; x = r['components']; d = r['decision']
    sha = sha or r['signals']['sha'] + ('*' if r['signals'].get('mutation') else '')
    rows += f'''<tr><th scope="row"><span class="mono">{sha}</span><br><span class="muted">{name}</span></th>
<td class="mono">{r["G"]}</td>''' + ''.join(f'<td class="mono">{x[k]:.3f}</td>' for k in 'QCSP') + f'''
<td class="mono">{r["linear_ungated"]:.3f}</td><td class="mono strong">{r["FRS"]:.3f}</td><td><span class="tag {DEC[d]}">{d.replace("-"," ").title().replace("With","with").replace("Fix Forward","fix-forward")}</span></td>
<td class="note">{html.escape(NOTES[key])}</td></tr>'''
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FalsifyBench — Release score (FRS)</title><link rel="icon" type="image/svg+xml" href="../favicon.svg"><meta name="theme-color" content="#1c2024">
<style>
@font-face{{font-family:Archivo;src:url(../assets/archivo-latin-wdth-normal-DY7AcnAa.woff2) format("woff2");font-weight:100 900;font-stretch:62% 125%;font-display:swap}}
@font-face{{font-family:"Red Hat Mono";src:url(../assets/red-hat-mono-latin-400-normal-C-lyubUB.woff2) format("woff2");font-weight:400;font-display:swap}}
@font-face{{font-family:"Red Hat Mono";src:url(../assets/red-hat-mono-latin-600-normal-BElMyFjl.woff2) format("woff2");font-weight:600;font-display:swap}}
:root{{--ground:236 237 233;--surface:250 250 247;--sunken:242 242 238;--ink:22 25 28;--ink-2:62 68 74;--ink-3:92 99 106;--rule:213 215 209;--rule-strong:133 138 132;--primary:36 71 154;--focus:59 111 224;--ok:36 101 58;--ok-tint:226 239 228;--warn:122 74 0;--warn-tint:250 237 207;--risk:158 42 32;--risk-tint:247 227 224;--shell:28 32 36;--shell-ink:241 242 238;--shell-muted:169 176 182;--shell-line:53 59 65}}
*{{box-sizing:border-box}}body{{margin:0;background:rgb(var(--ground));color:rgb(var(--ink));font:15px/1.55 Archivo,system-ui,sans-serif;font-variant-numeric:tabular-nums}}
.mono{{font-family:"Red Hat Mono",ui-monospace,monospace}}.muted{{color:rgb(var(--ink-3))}}.strong{{font-weight:600}}
header{{background:rgb(var(--shell));color:rgb(var(--shell-ink));border-bottom:1px solid rgb(var(--shell-line))}}
.bar{{max-width:1180px;margin:0 auto;padding:14px 24px;display:flex;gap:16px;align-items:baseline;justify-content:space-between}}
.brand{{font-weight:650;letter-spacing:.01em}}.brand span{{color:rgb(var(--shell-muted));font-weight:400}}
header a{{color:rgb(var(--shell-ink))}}a:focus-visible{{outline:2px solid rgb(var(--focus));outline-offset:2px}}
main{{max-width:1180px;margin:0 auto;padding:24px;display:grid;gap:20px}}
.sheet{{background:rgb(var(--surface));border:1px solid rgb(var(--rule));border-radius:4px;padding:20px 24px}}
h1{{font-size:26px;line-height:1.2;margin:0 0 6px;font-weight:650}}h2{{font-size:17px;margin:0 0 12px;font-weight:650}}
.eyebrow{{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgb(var(--ink-3));margin:0 0 6px}}
.hero{{display:grid;grid-template-columns:minmax(260px,32fr) 68fr;gap:28px;align-items:start}}
.score{{font-family:"Red Hat Mono",monospace;font-size:64px;line-height:1;font-weight:600}}
.verdict{{display:inline-block;margin-top:10px}}.tag{{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:3px;border:1px solid}}
.tag.ok{{color:rgb(var(--ok));background:rgb(var(--ok-tint))}}.tag.warn{{color:rgb(var(--warn));background:rgb(var(--warn-tint))}}.tag.risk{{color:rgb(var(--risk));background:rgb(var(--risk-tint))}}
.subs{{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}}.subhead{{display:flex;gap:8px;align-items:baseline}}
.subhead .k{{font-family:"Red Hat Mono",monospace;font-weight:600;width:16px}}.subhead .lbl{{flex:1}}.subhead .v{{font-family:"Red Hat Mono",monospace}}
.track{{height:6px;background:rgb(var(--sunken));border:1px solid rgb(var(--rule));border-radius:2px;margin:4px 0}}.fill{{height:100%;background:rgb(var(--primary))}}
.det{{margin:0;font-size:13px;color:rgb(var(--ink-2))}}
.formula{{font-family:"Red Hat Mono",monospace;font-size:15px;background:rgb(var(--sunken));border:1px solid rgb(var(--rule));border-radius:3px;padding:12px 14px;overflow-x:auto;white-space:pre;line-height:1.7}}
.cols{{display:grid;grid-template-columns:1fr 1fr;gap:20px}}dl{{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px}}dt{{font-family:"Red Hat Mono",monospace;font-weight:600}}dd{{margin:0;color:rgb(var(--ink-2))}}
table{{width:100%;border-collapse:collapse;font-size:14px}}th,td{{text-align:left;padding:9px 8px;border-top:1px solid rgb(var(--rule));vertical-align:top}}
thead th{{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgb(var(--ink-3));border-top:0;font-weight:600}}td.note{{color:rgb(var(--ink-2));max-width:360px}}
ol,ul{{margin:0;padding-left:20px}}li{{margin:4px 0}}.foot{{font-size:13px;color:rgb(var(--ink-3))}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important}}}}
</style></head><body>
<header><div class="bar"><div class="brand">FalsifyBench <span>· Release score</span></div><a href="../">Open the walkthrough</a></div></header>
<main>
<section class="sheet hero" aria-labelledby="h-score">
 <div><p class="eyebrow">Snapshot · main @ <span class="mono">{s["sha"]}</span> · 2026-10-03</p>
  <h1 id="h-score">FalsifyBench Release Score</h1>
  <div class="score" aria-label="FRS {m["FRS"]:.3f}">{m["FRS"]:.3f}</div>
  <span class="verdict tag {DEC[m["decision"]]}">{LABEL[m["decision"]]}</span>
  <p class="det" style="margin-top:12px">{gate_line} {s["unit_passed"]}/{s["unit_total"]} unit tests, {s["accept_passed"]}/60 playbook browser checks, {s["align_passed"]}/{s["align_total"]} fixture-vs-spec checks.</p></div>
 <div class="subs">
  {bar("Q", c["Q"], "Quality", f'Line coverage {pct(s["cov_lines"])}, branch coverage {pct(s["cov_branches"])}, design-token conformance {pct(s["token_conformance"])}.')}
  {bar("C", c["C"], "Correctness", f'Harmonic mean of unit pass rate ({s["unit_passed"]}/{s["unit_total"]}) and playbook acceptance in real Chrome ({s["accept_passed"]}/60, MAT-001 + EI-001).')}
  {bar("S", c["S"], "Synthetic-data alignment", f'MAT-001 and EI-001 fixtures, scorecards, sealed evaluations and receipt wiring checked against the playbook ({s["align_passed"]}/{s["align_total"]}); manual = auto-play receipt.')}
  {bar("P", c["P"], "Performance", f'Initial JS+CSS {s["initial_gzip_kb"]:.1f} kB gzip against an 80 kB budget; evaluation split into a lazy chunk.')}
 </div>
</section>
<section class="sheet" aria-labelledby="h-def"><h2 id="h-def">Definition</h2>
<div class="formula">FRS = G · H

H   = 1 / ( 0.20/Q + 0.35/C + 0.30/S + 0.15/P )        weighted harmonic mean, Σw = 1
G   = lint ∧ typecheck ∧ build ∧ no-bundle-leak ∧ no-DOM-leak-before-Audit ∧ no-network/secrets ∧ fixture-matches-spec   ∈ {{0,1}}

Q   = ( coverage_lines + coverage_branches + token_conformance ) / 3
C   = 2·u·a / (u + a)          u = unit tests passed / total,  a = browser acceptance checks passed / 60
S   = s · d                    s = fixture-vs-playbook checks passed / total,  d = 1 if manual ≡ auto-play receipt else 0.5
P   = 0.7 · min(1, 80 kB / initial_gzip) + 0.3 · [sealed evaluation in a lazy chunk]</div>
<div class="cols" style="margin-top:16px">
 <dl><dt>G</dt><dd>Hard gates. Any leak of the sealed evaluation before Audit, a failed build, a network call, or a fixture that contradicts the spec makes FRS = 0, whatever else scores.</dd>
 <dt>w</dt><dd>Correctness 0.35 and synthetic alignment 0.30 carry the product claim; quality 0.20; performance 0.15 (static PoC, little headroom risk).</dd></dl>
 <dl><dt>H</dt><dd>Harmonic, like F1: one weak dimension cannot be bought back by strong ones. 65cbf40 scores 0.919 linearly but 0.886 harmonically because Q = 0.61.</dd>
 <dt>Bands</dt><dd>Ship: FRS ≥ 0.95 and a = 1. Ship with fix-forward: 0.85 ≤ FRS, or a &lt; 1. Block: FRS &lt; 0.85 or G = 0.</dd></dl>
</div></section>
<section class="sheet" aria-labelledby="h-hist"><h2 id="h-hist">Validation across history and a deliberate break</h2>
<table><thead><tr><th scope="col">Revision</th><th scope="col">G</th><th scope="col">Q</th><th scope="col">C</th><th scope="col">S</th><th scope="col">P</th><th scope="col">Linear</th><th scope="col">FRS</th><th scope="col">Decision</th><th scope="col">Why</th></tr></thead>
<tbody>{rows}</tbody></table>
<p class="foot" style="margin-top:10px">* Mutation applied to a throwaway worktree of the main revision; not committed. A linear score would still rate these above 0.9; the gate blocks them.</p></section>
<div class="cols">
<section class="sheet" aria-labelledby="h-gaps"><h2 id="h-gaps">Gaps and trade-offs</h2><ol>
<li><strong>Not enforced.</strong> The repo has no CI, so FRS and the 60 browser checks only run when someone runs them.</li>
<li><strong>jsdom blind spot.</strong> The keyboard focus loss existed from the first commit to 2219a0f with every unit test green; only the real-browser check caught it. C must keep its browser half.</li>
<li><strong>Branch coverage {pct(s["cov_branches"])}</strong> is the weakest signal; least covered: {least}.</li>
<li><strong>Two scenarios.</strong> S and the browser checks cover MAT-001 and EI-001; Research validity is still a preview with no fixture.</li>
<li><strong>Paraphrased claims.</strong> Agent claim sentences differ in wording from the playbook (for example “operating cycles”); verdicts, confidences, actions and scores match exactly. Claim text is not scored.</li>
<li><strong>Performance at ceiling.</strong> {s["initial_gzip_kb"]:.1f} kB of 80 kB; P will not move until the bundle grows ~20%. Self-hosted fonts (woff2) are outside the budget.</li>
<li><strong>Redesign trade-off.</strong> Token conformance went 0 → 16/16 components and Q 0.61 → 0.95, at +1.3 kB gzip.</li>
</ol></section>
<section class="sheet" aria-labelledby="h-rec"><h2 id="h-rec">Recommendation</h2>
<p style="margin-top:0">Use FRS as the <strong>merge and deploy gate</strong> for this repository: run it on every PR head and before every redeploy of this preview.</p>
<ul><li>G = 0 or FRS &lt; 0.85: do not merge or deploy.</li>
<li>0.85–0.95, or any browser check failing: merge only with a linked fix-forward issue.</li>
<li>≥ 0.95 with 60/60: ship. Current main qualifies at {m["FRS"]:.3f}.</li></ul>
<p>Next lever: raise branch coverage (Q) and add the research-validity fixture.</p>
<p class="foot">Measured on Node 20, Chrome via CDP at 1280×800 and 1440×900, against <span class="mono">vite preview</span> of each revision. Synthetic fixture only; no model, partner or sponsor involved.</p></section>
</div>
</main></body></html>'''
open(os.path.join(ROOT, 'public', 'frs', 'index.html'), 'w').write(page)
