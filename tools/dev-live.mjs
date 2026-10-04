#!/usr/bin/env node
// npm run dev: the local server (server/index.ts) and `vite dev` together. Local machine only; Ctrl+C stops both.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'

// Both children inherit .env, so FALSIFYBENCH_SERVER_PORT moves the server and the vite /api proxy together.
if (existsSync('.env')) process.loadEnvFile('.env')

const port = Number(process.env.FALSIFYBENCH_SERVER_PORT) || 8787
// server/index.ts exits with this code when the port is taken (e.g. two npm run dev started together).
const PORT_BUSY_EXIT = 98
const portBusyMessage = `Port ${port} is already in use (another npm run dev or FalsifyBench server?). Stop it, or set FALSIFYBENCH_SERVER_PORT in .env, then rerun npm run dev.`
try {
  await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(port, '127.0.0.1', () => {
      probe.close((error) => (error ? reject(error) : resolve()))
    })
  })
} catch (error) {
  if (error?.code !== 'EADDRINUSE') throw error
  console.error(portBusyMessage)
  process.exit(1)
}

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
  console.error(`[server] exited (${status}); the app keeps running with the scripted agent (Live unavailable). Fix the error above (often: run npm install) and restart npm run dev.`)
}

server.on('error', (error) => reportServerExit(`could not start: ${error.message}`))
server.on('exit', (code, signal) => {
  if (code !== PORT_BUSY_EXIT) return reportServerExit(code ?? signal ?? 'signal')
  if (stopping) return
  console.error(portBusyMessage)
  stop(1)
})
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
