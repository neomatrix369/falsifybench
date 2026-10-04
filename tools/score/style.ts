// Score page styles built from the app's design tokens (src/index.css :root and tailwind.config.js), so the
// generated report can't drift from the app. See DESIGN.md.
import { readFileSync } from 'node:fs'
import tailwind from '../../tailwind.config.js'

const { fontFamily, fontSize, borderRadius, boxShadow } = tailwind.theme as {
  fontFamily: Record<'sans' | 'mono', string[]>
  fontSize: Record<string, [string, { lineHeight: string; letterSpacing?: string }]>
  borderRadius: Record<string, string>
  boxShadow: Record<string, string>
}

/** The `:root` token block from src/index.css, minified. */
export function rootTokens(css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')): string {
  const block = /:root\s*\{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1]
  if (!block) throw new Error('src/index.css has no :root token block')
  return `:root{${block.split(';').map((d) => d.trim()).filter(Boolean).join(';')}}`
}

/** A token as a CSS colour, e.g. token('shell') → rgb(28 32 36). */
export function token(name: string): string {
  const value = new RegExp(`--${name}:([^;]+)`).exec(rootTokens())?.[1]
  if (!value) throw new Error(`unknown design token --${name}`)
  return `rgb(${value.trim()})`
}

const family = (stack: string[]) => stack.join(',')
export const SANS = family(fontFamily.sans)
export const MONO = family(fontFamily.mono)
export const ARCHIVO = fontFamily.sans[0]

/** Tailwind type-scale step (meta, body, lead, title, display, reading) as declarations. */
const type = (step: string) => {
  const [size, { lineHeight, letterSpacing }] = fontSize[step]
  return `font-size:${size};line-height:${lineHeight}${letterSpacing ? `;letter-spacing:${letterSpacing}` : ''}`
}
// The app's `.label`: text-meta font-medium text-ink-3, sentence case.
const label = `${type('meta')};font-weight:500;color:rgb(var(--ink-3))`

export const SCORE_CSS = `
${rootTokens()}
*{box-sizing:border-box}body{margin:0;background:rgb(var(--ground));color:rgb(var(--ink));font-family:${SANS};${type('body')};font-stretch:100%;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.mono{font-family:${MONO}}.muted{color:rgb(var(--ink-3))}.strong{font-weight:600}
header{background:rgb(var(--shell));color:rgb(var(--shell-ink));border-bottom:1px solid rgb(var(--shell-line));box-shadow:${boxShadow.shell}}
.bar{max-width:1180px;margin:0 auto;padding:14px 24px;display:flex;gap:16px;align-items:baseline;justify-content:space-between}
.brand{${type('lead')};font-weight:600;font-stretch:118%}.brand span{${type('body')};color:rgb(var(--shell-muted));font-weight:400;font-stretch:100%}
header a{color:rgb(var(--shell-ink));text-underline-offset:3px}a{text-underline-offset:3px}a:focus-visible{outline:2px solid rgb(var(--focus));outline-offset:2px}
main{max-width:1180px;margin:0 auto;padding:24px;display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
.sheet{background:rgb(var(--surface));border:1px solid rgb(var(--rule));border-radius:${borderRadius.md};box-shadow:${boxShadow.sheet};padding:20px 24px;min-width:0}
h1{${type('display')};margin:0 0 8px;font-weight:600;font-stretch:108%}h2{${type('title')};margin:0 0 4px;font-weight:600;font-stretch:108%}
.lead{margin:0 0 16px;color:rgb(var(--ink-2))}
.label{${label};margin:0 0 4px}
.hero{display:grid;grid-template-columns:minmax(0,40fr) minmax(0,60fr);gap:32px;align-items:start}
.pair{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px}
.big{font-family:${MONO};${type('reading')};font-weight:600}.big.dim{color:rgb(var(--ink-3))}
.cap{${type('meta')};color:rgb(var(--ink-2));margin-top:8px}
.tag{display:inline-block;${type('meta')};font-weight:600;padding:2px 8px;border-radius:${borderRadius.sm};border:1px solid;white-space:nowrap}
.tag.ok{color:rgb(var(--ok));background:rgb(var(--ok-tint));border-color:rgb(var(--ok-line))}.tag.warn{color:rgb(var(--warn));background:rgb(var(--warn-tint));border-color:rgb(var(--warn-line))}.tag.risk{color:rgb(var(--risk));background:rgb(var(--risk-tint));border-color:rgb(var(--risk-line))}
.stats{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);gap:8px 20px;align-items:baseline}
.stats dt{color:rgb(var(--ink-2))}.stats dd{margin:0;font-family:${MONO}}
.stats .h{${label};font-family:${SANS};padding-bottom:4px;border-bottom:1px solid rgb(var(--rule))}
.method{display:grid;grid-template-columns:minmax(0,58fr) minmax(0,42fr);gap:32px;align-items:start}
.eqs{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px 16px;align-items:baseline;background:rgb(var(--sunken));border:1px solid rgb(var(--rule));border-radius:${borderRadius.DEFAULT};padding:16px;overflow-x:auto}
.eqs dt{${label};white-space:nowrap}.eqs dd{margin:0}
math{font-family:"STIX Two Math","Cambria Math","Latin Modern Math","DejaVu Serif","Times New Roman",serif;font-size:1.0625rem;color:rgb(var(--ink))}
.legend{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 12px;align-items:baseline}.legend dt{text-align:right}.legend dd{margin:0;color:rgb(var(--ink-2))}
.worked{margin:16px 0 0;line-height:2.2;color:rgb(var(--ink-2))}.worked math{font-size:0.9375rem}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-top:1px solid rgb(var(--rule));vertical-align:top}
thead th{${label};border-top:0}
td.n,th.n{text-align:right;font-family:${MONO}}thead th.n{font-family:${SANS}}tr.first th,tr.first td{border-top:1px solid rgb(var(--rule-strong))}
td.det{${type('meta')};color:rgb(var(--ink-2));overflow-wrap:anywhere}
ul{margin:0;padding-left:20px}li{margin:4px 0}.foot{${type('meta')};color:rgb(var(--ink-3))}
`
