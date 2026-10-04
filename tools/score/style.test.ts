// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCORE_CSS, rootTokens, token } from './style'

const html = readFileSync(new URL('../../public/score/index.html', import.meta.url), 'utf8')
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')

function designRuleViolations(css: string): string[] {
  return [
    /text-transform\s*:\s*uppercase/i.test(css) && 'uppercase labels',
    /letter-spacing\s*:\s*\+?\.?\d/i.test(css) && 'positive letter-spacing (tracked eyebrow)',
    /#[0-9a-f]{3,8}\b/i.test(css) && 'raw hex colour',
  ].filter((v): v is string => Boolean(v))
}

describe('score page design system', () => {
  it('SCORE_CSS follows DESIGN.md: no uppercase tracked labels, no raw hex', () => {
    expect(designRuleViolations(SCORE_CSS)).toEqual([])
  })

  it('the published score page follows DESIGN.md', () => {
    expect(designRuleViolations(styles)).toEqual([])
    expect(html).not.toMatch(/class="eyebrow"/)
    expect(html).not.toMatch(/content="#[0-9a-f]+"/i)
  })

  it('uses the tokens from src/index.css (regenerate with npm run score if this fails)', () => {
    expect(styles).toContain(rootTokens())
    expect(html).toContain(`<meta name="theme-color" content="${token('shell')}">`)
  })

  it('every token the page references is defined in src/index.css', () => {
    const defined = new Set([...rootTokens().matchAll(/--([\w-]+):/g)].map((m) => m[1]))
    const used = [...SCORE_CSS.matchAll(/var\(--([\w-]+)\)/g)].map((m) => m[1])
    expect(used.length).toBeGreaterThan(0)
    expect(used.filter((t) => !defined.has(t))).toEqual([])
  })

  it('flags an uppercase tracked eyebrow', () => {
    expect(designRuleViolations('.eyebrow{letter-spacing:.08em;text-transform:uppercase;color:#5c636a}')).toEqual([
      'uppercase labels',
      'positive letter-spacing (tracked eyebrow)',
      'raw hex colour',
    ])
  })

  it('loads no remote fonts or scripts', () => {
    expect(html).not.toMatch(/<script|https?:\/\/(?!www\.w3\.org)/i)
  })
})
