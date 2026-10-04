#!/usr/bin/env node
// npm run dev: the local server (server/index.ts) and `vite dev` together. Local machine only; Ctrl+C stops both.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, watch } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { parseEnv } from 'node:util'

const inheritedEnvKeys = new Set(Object.keys(process.env))
let loadedEnvKeys = new Set()
function loadEnvFile() {
  for (const key of loadedEnvKeys) {
    if (!inheritedEnvKeys.has(key)) delete process.env[key]
  }
  loadedEnvKeys = new Set()
  if (!existsSync('.env')) return
  for (const [key, value] of Object.entries(parseEnv(readFileSync('.env', 'utf8')))) {
    loadedEnvKeys.add(key)
    if (!inheritedEnvKeys.has(key)) process.env[key] = value
  }
}

loadEnvFile()

const port = Number(process.env.FALSIFYBENCH_SERVER_PORT) || 8787
// server/index.ts exits with this code when the port is taken (e.g. two npm run dev started together).
const PORT_BUSY_EXIT = 98
const portBusyMessage = () =>
  `Port ${Number(process.env.FALSIFYBENCH_SERVER_PORT) || 8787} is already in use (another npm run dev or FalsifyBench server?). Stop it, or set FALSIFYBENCH_SERVER_PORT in .env, then rerun npm run dev.`
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
  console.error(portBusyMessage())
  process.exit(1)
}

const bin = (name) => join(process.cwd(), 'node_modules', '.bin', name)
let stopping = false
let serverExitReported = false
let server = null
let vite = null
let serverGeneration = 0
let serverRetryTimer
let restartTimer
let restartInProgress = false
let restartRequested = false
const watchers = []
const intentionalServerStops = new WeakSet()

function prefixOutput(name, child) {
  const prefix = (stream, out) => stream.on('data', (data) => out.write(String(data).replace(/^(?=.)/gm, `[${name}] `)))
  prefix(child.stdout, process.stdout)
  prefix(child.stderr, process.stderr)
}

function reportServerExit(status) {
  if (stopping || serverExitReported) return
  serverExitReported = true
  console.error(`[server] exited (${status}); the app keeps running with the scripted agent (Live unavailable). Fix the error above (often: run npm install) and restart npm run dev.`)
}

function startServer(retriedAfterBusy = false) {
  if (stopping) return
  if (serverRetryTimer !== undefined) {
    clearTimeout(serverRetryTimer)
    serverRetryTimer = undefined
  }
  loadEnvFile()
  serverExitReported = false
  const child = spawn(bin('vite-node'), ['server/index.ts'], { stdio: ['ignore', 'pipe', 'pipe'] })
  const generation = ++serverGeneration
  server = child
  prefixOutput('server', child)
  child.on('error', (error) => {
    if (server !== child || intentionalServerStops.has(child)) return
    server = null
    reportServerExit(`could not start: ${error.message}`)
  })
  child.on('exit', (code, signal) => {
    if (server !== child) return
    server = null
    if (stopping || intentionalServerStops.has(child)) return
    if (code === PORT_BUSY_EXIT) {
      if (!retriedAfterBusy) {
        serverRetryTimer = setTimeout(() => {
          serverRetryTimer = undefined
          if (stopping || server !== null || generation !== serverGeneration) return
          startServer(true)
        }, 500)
        return
      }
      console.error(portBusyMessage())
      stop(1)
      return
    }
    reportServerExit(code ?? signal ?? 'signal')
  })
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      child.off('exit', done)
      child.off('error', done)
      resolve()
    }
    child.once('exit', done)
    child.once('error', done)
  })
}

async function restartServer() {
  if (stopping) return
  if (restartInProgress) {
    restartRequested = true
    return
  }
  restartInProgress = true
  try {
    do {
      restartRequested = false
      console.log('[dev] server code changed; restarting the server')
      const oldServer = server
      if (oldServer && oldServer.exitCode === null && oldServer.signalCode === null) {
        intentionalServerStops.add(oldServer)
        const exited = waitForExit(oldServer)
        oldServer.kill('SIGTERM')
        await exited
      }
      if (stopping) return
      startServer()
    } while (restartRequested && !stopping)
  } finally {
    restartInProgress = false
  }
}

function scheduleRestart() {
  if (stopping) return
  if (restartTimer !== undefined) clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    restartTimer = undefined
    void restartServer()
  }, 300)
}

function watchDirectory(directory) {
  const watcher = watch(directory, { recursive: true }, (_event, filename) => {
    if (filename !== null && String(filename).endsWith('.test.ts')) return
    scheduleRestart()
  })
  watcher.on('error', (error) => console.error(`[dev] watcher failed: ${error.message}`))
  watchers.push(watcher)
}

function watchEnvFile() {
  const watcher = watch(process.cwd(), (_event, filename) => {
    if (filename === null || String(filename) === '.env') scheduleRestart()
  })
  watcher.on('error', (error) => console.error(`[dev] watcher failed: ${error.message}`))
  watchers.push(watcher)
}

function stop(code) {
  if (stopping) return
  stopping = true
  if (restartTimer !== undefined) clearTimeout(restartTimer)
  if (serverRetryTimer !== undefined) clearTimeout(serverRetryTimer)
  for (const watcher of watchers) watcher.close()
  for (const child of [server, vite]) {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  }
  process.exitCode = code
}

function startVite() {
  const child = spawn(bin('vite'), process.argv.slice(2), { stdio: ['ignore', 'pipe', 'pipe'] })
  vite = child
  prefixOutput('vite', child)
  child.on('error', (error) => {
    if (stopping) return
    console.error(`[vite] failed to start: ${error.message}`)
    stop(1)
  })
  child.on('exit', (code, signal) => {
    if (stopping) return
    console.log(`[vite] exited (${code ?? signal ?? 'signal'}); stopping the server`)
    stop(code ?? 1)
  })
}

for (const directory of ['server', 'src/domain', 'src/data']) watchDirectory(directory)
watchEnvFile()
startServer()
startVite()

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
