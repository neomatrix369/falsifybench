#!/usr/bin/env node
// postbuild: fails `npm run build` if the static site in dist/ contains an Anthropic key or the key's variable name.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(process.cwd(), 'dist')
const NEEDLES = ['sk-ant', 'ANTHROPIC_API_KEY']

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else yield path
  }
}

const hits = []
for (const path of files(root)) {
  const text = readFileSync(path).toString('latin1')
  for (const needle of NEEDLES) if (text.includes(needle)) hits.push(`${relative(process.cwd(), path)}: contains "${needle}"`)
}

if (hits.length) {
  console.error('Secret check failed: the deployed build must never carry an API key.')
  for (const hit of hits) console.error(`  - ${hit}`)
  process.exit(1)
}
console.log(`Secret check passed: no ${NEEDLES.join(' or ')} in dist/.`)
