// @vitest-environment node
// Keeps docs/PIPELINE.md in step with the code: every stage, action, trigger, status, Run log label, guarded evidence fact and turn kind must appear in it.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STAGES, STAGE_LABELS } from '../../src/domain/stages'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const doc = read('docs/PIPELINE.md')
const walkthrough = read('src/domain/walkthrough.ts')
const runLog = read('src/domain/runLog.ts')
const types = read('src/domain/types.ts')
const turnTrace = read('src/components/TurnTrace.tsx')
const section = (heading: string) => {
  const start = doc.indexOf(`\n## ${heading}\n`)
  expect(start, `section "${heading}"`).toBeGreaterThan(-1)
  const end = doc.indexOf('\n## ', start + 1)
  return doc.slice(start, end === -1 ? undefined : end)
}
const unionMembers = (src: string, name: string) => {
  const m = new RegExp(`export type ${name} =([^\\n]+)`).exec(src)
  expect(m, name).not.toBeNull()
  return [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

describe('docs/PIPELINE.md', () => {
  it('lists the five stages in order', () => {
    const rows = [...section('Stages').matchAll(/^\| S\d \| ([^|]+) \|/gm)].map((m) => m[1].trim())
    expect(rows).toEqual(STAGES.map((s) => STAGE_LABELS[s]))
  })

  it('names every walkthrough action', () => {
    const actions = [...walkthrough.matchAll(/\{ type: '([A-Z_]+)'/g)].map((m) => m[1])
    expect(actions.length).toBeGreaterThan(0)
    for (const action of actions) expect(section('Inputs'), action).toContain(`\`${action}\``)
  })

  it('names every stage trigger and walkthrough status', () => {
    for (const name of [...unionMembers(walkthrough, 'StageTrigger'), ...unionMembers(walkthrough, 'WalkthroughStatus')]) {
      expect(section('Inputs'), name).toContain(`\`${name}\``)
    }
  })

  it('names every fixed Run log entry label', () => {
    const labels = [...runLog.matchAll(/label: '([^']+)'/g)].map((m) => m[1])
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) expect(section('Outputs'), label).toContain(`\`${label}\``)
  })

  it('names every Run log fact built from the guarded evidence basis or the turn trace', () => {
    const facts = [...runLog.matchAll(/key: '([^']+)',\s*value: `[^`]*evaluation\.(guardedBasis|turns)\b/g)].map((m) => ({ key: m[1], field: m[2] }))
    expect(facts.map((f) => f.field).sort()).toEqual(['guardedBasis', 'turns'])
    for (const { key, field } of facts) {
      expect(section('Outputs'), key).toContain(`\`${key}\``)
      expect(doc, field).toContain(`\`${field}\``)
    }
  })

  it('names every turn kind and its trace label', () => {
    const kinds = unionMembers(types, 'TurnKind')
    expect(kinds.length).toBeGreaterThan(0)
    for (const kind of kinds) {
      const label = new RegExp(`${kind}: \\{ label: '([^']+)'`).exec(turnTrace)
      expect(label, `TurnTrace label for ${kind}`).not.toBeNull()
      expect(section('Stages'), kind).toContain(`\`${kind}\``)
      expect(section('Stages'), label![1]).toContain(label![1])
    }
  })

  it('keeps every open gap in the end-state table', () => {
    const gaps = [...section('Known gaps').matchAll(/^\| (G\d+) \|/gm)].map((m) => m[1])
    for (const gap of gaps) expect(section('Every way a run ends'), gap).toContain(`Gap ${gap}`)
  })
})
