// Local-only server for live baseline calls (`npm run dev`). The deployed static build never talks to it.
import { existsSync } from 'node:fs'
import { LIVE_UPSTREAM_TIMEOUT_MS } from '../src/domain/live'
import { createLocalServer } from './app'
import { describeConfig, readConfig } from './config'

if (existsSync('.env')) process.loadEnvFile('.env')

const config = readConfig(process.env, LIVE_UPSTREAM_TIMEOUT_MS)
/** Exit code tools/dev-live.mjs reads as "port busy", so it stops Vite instead of proxying to another server. */
const PORT_BUSY_EXIT = 98

createLocalServer(config)
  .on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EADDRINUSE') throw error
    console.error(`Port ${config.port} is already in use.`)
    process.exit(PORT_BUSY_EXIT)
  })
  .listen(config.port, '127.0.0.1', () => {
    console.log(`FalsifyBench local server on http://127.0.0.1:${config.port} · ${describeConfig(config)}`)
  })
