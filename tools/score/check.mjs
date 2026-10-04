#!/usr/bin/env node
// Fails when public/score is not what `npm run score` generates from the current data.
// Leaves public/score exactly as it found it.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const DIR = 'public/score'

function snapshot() {
  const files = new Map()
  if (!existsSync(DIR)) return files
  for (const name of readdirSync(DIR, { withFileTypes: true })) {
    if (name.isFile()) files.set(name.name, readFileSync(join(DIR, name.name)))
  }
  return files
}

function restore(files) {
  mkdirSync(DIR, { recursive: true })
  for (const name of snapshot().keys()) {
    if (!files.has(name)) rmSync(join(DIR, name))
  }
  for (const [name, content] of files) writeFileSync(join(DIR, name), content)
}

const before = snapshot()
const run = spawnSync('npm', ['run', '--silent', 'score'], { stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' })
const after = snapshot()
restore(before)

if (run.status !== 0) {
  process.stdout.write(run.stdout ?? '')
  console.error(`score:check: npm run score failed (exit ${run.status ?? run.signal}); ${DIR} left unchanged.`)
  process.exit(1)
}

const stale = [...new Set([...before.keys(), ...after.keys()])]
  .filter((name) => !before.has(name) || !after.has(name) || !before.get(name).equals(after.get(name)))
  .sort()
  .map((name) => `${DIR}/${name}${!before.has(name) ? ' (missing)' : !after.has(name) ? ' (no longer generated)' : ''}`)

if (stale.length > 0) {
  console.error('score:check: the score report is stale; it does not match the current benchmark data:')
  for (const file of stale) console.error(`  - ${file}`)
  console.error('Run `npm run score` and commit the result.')
  process.exit(1)
}

console.log(`score:check: ${DIR} is up to date.`)
