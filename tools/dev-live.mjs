#!/usr/bin/env node
// npm run dev:live: the local server (server/index.ts) and `vite dev` together. Local machine only; Ctrl+C stops both.
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const bin = (name) => join(process.cwd(), 'node_modules', '.bin', name)
const children = [
  ['server', bin('vite-node'), ['server/index.ts']],
  ['vite', bin('vite'), process.argv.slice(2)],
].map(([name, cmd, args]) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = (stream, out) => stream.on('data', (d) => out.write(String(d).replace(/^(?=.)/gm, `[${name}] `)))
  prefix(child.stdout, process.stdout)
  prefix(child.stderr, process.stderr)
  child.on('exit', (code) => {
    console.log(`[${name}] exited (${code ?? 'signal'}); stopping the other process`)
    stop(code ?? 1)
  })
  return child
})

let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  process.exitCode = code
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
