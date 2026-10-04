#!/usr/bin/env node
// npm run dev: the local server (server/index.ts) and `vite dev` together. Local machine only; Ctrl+C stops both.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Both children inherit .env, so FALSIFYBENCH_SERVER_PORT moves the server and the vite /api proxy together.
if (existsSync('.env')) process.loadEnvFile('.env')

const bin = (name) => join(process.cwd(), 'node_modules', '.bin', name)
const children = [
  ['server', bin('vite-node'), ['server/index.ts']],
  ['vite', bin('vite'), process.argv.slice(2)],
].map(([name, cmd, args]) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = (stream, out) => stream.on('data', (d) => out.write(String(d).replace(/^(?=.)/gm, `[${name}] `)))
  prefix(child.stdout, process.stdout)
  prefix(child.stderr, process.stderr)
  return child
})

let stopping = false
let serverExitReported = false
const [server, vite] = children

function reportServerExit(status) {
  if (stopping || serverExitReported) return
  serverExitReported = true
  console.error(`[server] exited (${status}); the app keeps running with the scripted agent (Live unavailable). Fix the error above (often: run npm install, or free port 8787) and restart npm run dev.`)
}

server.on('error', (error) => reportServerExit(`could not start: ${error.message}`))
server.on('exit', (code, signal) => reportServerExit(code ?? signal ?? 'signal'))
vite.on('error', (error) => {
  if (stopping) return
  console.error(`[vite] failed to start: ${error.message}`)
  stop(1)
})
vite.on('exit', (code, signal) => {
  if (stopping) return
  console.log(`[vite] exited (${code ?? signal ?? 'signal'}); stopping the server`)
  stop(code ?? 1)
})

function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  process.exitCode = code
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
