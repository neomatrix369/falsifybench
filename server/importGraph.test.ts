// @vitest-environment node
// The local server must never reach grading truth or hand scores: no *.evaluation.ts, *.scores.ts, *.agents.ts,
// fixtureScores or graders in its static import graph, and no way to call the lazy `evaluation.unseal()` loaders.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publicScenario, PUBLIC_SCENARIO_IDS } from './scenarios'

const ROOT = resolve(__dirname, '..')
const FORBIDDEN = /(\.evaluation|\.scores|\.agents)\.ts$|fixtureScores\.ts$|fixtureGrader\.ts$|(^|\/)grader\.ts$|ruleGraderSeam\.ts$/

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(from), spec)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) if (existsSync(candidate) && candidate.match(/\.tsx?$/)) return candidate
  throw new Error(`Cannot resolve ${spec} from ${relative(ROOT, from)}`)
}

/** Static imports (`import … from`, `export … from`, side-effect imports) and dynamic `import()` targets, per file. */
export function importGraph(entry: string) {
  const staticFiles = new Set<string>()
  const dynamic: { from: string; to: string }[] = []
  const queue = [resolve(ROOT, entry)]
  while (queue.length) {
    const file = queue.pop()!
    if (staticFiles.has(file)) continue
    staticFiles.add(file)
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) {
      const target = resolveImport(file, m[1] ?? m[2])
      if (target) queue.push(target)
    }
    for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const target = resolveImport(file, m[1])
      if (target) dynamic.push({ from: relative(ROOT, file), to: relative(ROOT, target) })
    }
  }
  return { staticFiles: [...staticFiles].map((f) => relative(ROOT, f)), dynamic }
}

describe('server import graph', () => {
  const graph = importGraph('server/index.ts')

  it('statically reaches no evaluation, score, scripted-answer or grader module', () => {
    expect(graph.staticFiles).toContain('server/scenarios.ts')
    expect(graph.staticFiles).toContain('src/data/ei001.ts')
    expect(graph.staticFiles.filter((f) => FORBIDDEN.test(f))).toEqual([])
  })

  it('has only the public fixtures’ lazy unseal loaders as dynamic edges, which the server strips and never calls', () => {
    for (const edge of graph.dynamic) {
      expect(edge.from).toMatch(/^src\/data\/[a-z0-9]+\.ts$/)
      expect(edge.to).toBe(edge.from.replace(/\.ts$/, '.evaluation.ts'))
    }
    for (const file of graph.staticFiles.filter((f) => f.startsWith('server/'))) {
      expect(readFileSync(join(ROOT, file), 'utf8'), file).not.toMatch(/\.unseal\b|(?:scenario|s)\.baseline\b/)
    }
    for (const id of PUBLIC_SCENARIO_IDS) {
      expect(Object.keys(publicScenario(id)!).sort()).toEqual(['domain', 'evidence', 'id', 'input', 'question', 'task', 'title', 'version'])
    }
  })

  it('would catch a forbidden import (the walker sees static and dynamic edges)', () => {
    expect(importGraph('src/domain/fixtureGrader.ts').staticFiles).toContain('src/data/fixtureScores.ts')
    expect(importGraph('src/data/scriptedAgentRunner.ts').dynamic.map((e) => e.to)).toContain('src/data/ei001.agents.ts')
  })
})
