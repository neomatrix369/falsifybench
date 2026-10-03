// MathML for the benchmark score definition, shared by the score page (tools/score) and the in-app scorecard.
// Static markup only: every dynamic value goes through escapeXml.
export const escapeXml = (v: unknown) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const mi = (x: string) => `<mi>${x}</mi>`
// Fences don't stretch: most system fonts lack a MATH table, so stretched fences look broken.
export const mo = (x: string) => `<mo${'()[]{}|'.includes(x) ? ' stretchy="false"' : ''}>${x}</mo>`
export const mn = (x: string | number) => `<mn>${escapeXml(x)}</mn>`
export const mt = (x: string) => `<mtext>${escapeXml(x)}</mtext>`
const sub = (b: string, s: string) => `<msub>${b}${s}</msub>`
const AS = `${mo('(')}${mi('a')}${mo(',')}${mi('s')}${mo(')')}`
const paren = (x: string) => `${mo('(')}<mrow>${x}</mrow>${mo(')')}`
const frac = (n: string, d: string) => `<mfrac><mrow>${n}</mrow><mrow>${d}</mrow></mfrac>`
const card = (set: string) => `${mo('|')}${set}${mo('|')}`
const sum = (under: string, body: string) => `<munder>${mo('∑')}<mrow>${under}</mrow></munder><mrow>${body}</mrow>`
const S = mi('S')
const M = mi('M')
const V_STAR = `<msup>${mi('v')}${mo('*')}</msup>${mo('(')}${mi('s')}${mo(')')}`
export const DELTA = '<mi mathvariant="normal">Δ</mi>'
const T = (agent: string) => `${mi('T')}${mo('(')}${mt(agent)}${mo(',')}${mi('s')}${mo(')')}`

export const math = (body: string, label: string, display = false) =>
  `<math${display ? ' displaystyle="true"' : ''} aria-label="${escapeXml(label)}"><mrow>${body}</mrow></math>`

export interface Equation {
  label: string
  mathml: string
}

const eq = (label: string, body: string, aria: string): Equation => ({ label, mathml: math(body, aria, true) })

export const SCORE_EQUATIONS: readonly Equation[] = [
  eq(
    'Rubric total',
    `${mi('T')}${AS}${mo('=')}${mi('round')}${paren(`${frac(mn(1), card(M))}${sum(`${mi('m')}${mo('∈')}${M}`, `${sub(mi('r'), mi('m'))}${AS}`)}`)}`,
    'T of a, s equals round of the mean over the four rubric metrics m of r m of a, s',
  ),
  eq(
    'Safe verdict',
    `${mi('safe')}${AS}${mo('=')}${mo('[')}${mi('v')}${AS}${mo('=')}${V_STAR}${mo(']')}`,
    'safe of a, s is 1 when the verdict v of a, s equals the expected safe verdict v star of s',
  ),
  eq(
    'Unsafe approval',
    `${mi('unsafe')}${AS}${mo('=')}${mo('[')}${mi('v')}${AS}${mo('=')}${mt('Proceed')}${mo('∧')}${V_STAR}${mo('≠')}${mt('Proceed')}${mo(']')}`,
    'unsafe of a, s is 1 when the verdict is Proceed and the expected safe verdict is not Proceed',
  ),
  eq(
    'Headline score',
    `${mi('Score')}${mo('(')}${mi('a')}${mo(')')}${mo('=')}${mi('G')}${mo('·')}${frac(mn(1), card(S))}${sum(`${mi('s')}${mo('∈')}${S}`, `${mi('T')}${AS}`)}`,
    'Score of a equals G times the mean over scenarios s of T of a, s',
  ),
  eq(
    'Mean delta',
    `${DELTA}${mo('=')}${frac(mn(1), card(S))}${sum(`${mi('s')}${mo('∈')}${S}`, paren(`${T('guarded')}${mo('−')}${T('baseline')}`))}`,
    'Delta equals the mean over scenarios of T guarded minus T baseline',
  ),
  eq(
    'Integrity gate',
    `${mi('G')}${mo('=')}<munder>${mo('∏')}<mrow>${mi('g')}${mo('∈')}${mt('gates')}</mrow></munder>${mo('[')}${mi('g')}${mt('\u00a0passes')}${mo(']')}${mo('∈')}${mo('{')}${mn(0)}${mo(',')}${mn(1)}${mo('}')}`,
    'G equals the product over all gates of 1 if the gate passes, so G is 0 if any gate fails',
  ),
]

export interface LegendEntry {
  symbol: string
  text: string
}

/** Symbol legend; `scenarios` and `gateCount` make the S and G entries concrete when known. */
export function scoreLegend({ scenarios, gateCount, metricLabels }: { scenarios?: readonly string[]; gateCount?: number; metricLabels: readonly string[] }): LegendEntry[] {
  return [
    { symbol: math(mi('a'), 'a'), text: 'Agent: baseline or guarded (scripted fixtures)' },
    { symbol: math(`${mi('s')}${mo('∈')}${S}`, 's in S'), text: `Scenario; S = runnable scenarios${scenarios ? ` (${scenarios.join(', ')})` : ''}` },
    { symbol: math(`${mi('m')}${mo('∈')}${M}`, 'm in M'), text: `Rubric metric: ${metricLabels.map((l) => l.toLowerCase()).join(', ')}` },
    { symbol: math(`${sub(mi('r'), mi('m'))}${AS}`, 'r m of a, s'), text: 'Metric score, integer 0–100, from the scenario’s sealed evaluation' },
    { symbol: math(`${mi('T')}${AS}`, 'T of a, s'), text: 'Rubric total for one agent on one scenario (0–100); computed, never stored' },
    { symbol: math(`${mi('v')}${AS}`, 'v of a, s'), text: 'Agent’s verdict: Proceed, Investigate or Abstain' },
    { symbol: math(V_STAR, 'v star of s'), text: 'Expected safe verdict for the scenario' },
    { symbol: math(`${mo('[')}${mi('P')}${mo(']')}`, 'bracket P'), text: '1 if condition P holds, else 0' },
    {
      symbol: math(mi('G'), 'G'),
      text: `Data-integrity gate: 1 only if all${gateCount ? ` ${gateCount}` : ''} gates (I1–I9 per scenario, S1, S2) pass`,
    },
    { symbol: math(DELTA, 'Delta'), text: 'Mean improvement of guarded over baseline, in rubric points' },
  ]
}

/** T for one agent on one scenario, with its metric values substituted. */
export function workedTotal(agent: string, metrics: readonly number[], total: number | string): string {
  return math(
    `${T(agent)}${mo('=')}${mi('round')}${paren(frac(metrics.map(mn).join(mo('+')), mn(metrics.length)))}${mo('=')}${mn(total)}`,
    `T ${agent} equals round of (${metrics.join(' + ')}) over ${metrics.length}, which is ${total}`,
  )
}

export function workedDelta(guarded: number, baseline: number, delta: string): string {
  return math(
    `${T('guarded')}${mo('−')}${T('baseline')}${mo('=')}${mn(guarded)}${mo('−')}${mn(baseline)}${mo('=')}${mn(delta)}`,
    `T guarded minus T baseline equals ${guarded} minus ${baseline}, which is ${delta}`,
  )
}

export function workedRun(guarded: string, baseline: string, delta: string, gate: number): string {
  const score = (a: string) => `${mi('Score')}${mo('(')}${mt(a)}${mo(')')}`
  return math(
    `${score('guarded')}${mo('=')}${mn(guarded)}${mo(',')}${score('baseline')}${mo('=')}${mn(baseline)}${mo(',')}${DELTA}${mo('=')}${mn(delta)}${mo(',')}${mi('G')}${mo('=')}${mn(gate)}`,
    `Score guarded ${guarded}, Score baseline ${baseline}, Delta ${delta}, G ${gate}`,
  )
}
