#!/usr/bin/env node
// Fails fast when node_modules is missing or partially installed, before Vite
// reports a confusing "Failed to resolve entry for package" error.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
const problems = []

for (const name of names) {
  const dir = join(root, 'node_modules', name)
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) {
    problems.push(`${name}: not installed`)
    continue
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const field of ['main', 'module']) {
    const entry = manifest[field]
    if (typeof entry === 'string' && !existsSync(join(dir, entry))) {
      problems.push(`${name}@${manifest.version}: "${field}" entry ${entry} is missing`)
    }
  }
}

if (problems.length > 0) {
  console.error('Dependencies are missing or incomplete:')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\nReinstall cleanly, then retry:\n  rm -rf node_modules && npm ci')
  process.exit(1)
}
