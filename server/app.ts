import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import Anthropic from '@anthropic-ai/sdk'
import { LIVE_BASELINE_ENDPOINT, LIVE_HEALTH_ENDPOINT, type LiveErrorBody, type LiveHealth } from '../src/domain/live'
import { askBaseline } from './anthropic'
import type { ServerConfig } from './config'
import { PUBLIC_SCENARIO_IDS, publicScenario } from './scenarios'

const MAX_BODY_BYTES = 4096

class BadRequest extends Error {}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

const fail = (res: ServerResponse, status: number, error: LiveErrorBody['error']) => send(res, status, { error })

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new BadRequest(`body is larger than ${MAX_BODY_BYTES} bytes`)
    chunks.push(chunk as Buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new BadRequest('body is not JSON')
  }
}

/** Every problem with a baseline request at once. */
export function baselineRequestProblems(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return ['body must be a JSON object { scenarioId }']
  const { scenarioId, ...rest } = body as Record<string, unknown>
  const problems: string[] = []
  if (typeof scenarioId !== 'string') problems.push('scenarioId must be a string')
  else if (!publicScenario(scenarioId)) problems.push(`scenarioId must be one of ${PUBLIC_SCENARIO_IDS.join(', ')} (got ${JSON.stringify(scenarioId)})`)
  const extra = Object.keys(rest)
  if (extra.length) problems.push(`unexpected field${extra.length > 1 ? 's' : ''}: ${extra.join(', ')}`)
  return problems
}

export function createLocalServer(config: ServerConfig, log: (line: string) => void = console.log): Server {
  const client = config.apiKey
    ? new Anthropic({ apiKey: config.apiKey, ...(config.baseURL ? { baseURL: config.baseURL } : {}), maxRetries: 0 })
    : null

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (path === LIVE_HEALTH_ENDPOINT && req.method === 'GET') {
      const health: LiveHealth = {
        configured: client !== null,
        provider: 'anthropic',
        model: config.model,
        ...(client ? {} : { reason: 'No Anthropic API key in the local server environment (.env).' }),
      }
      return send(res, 200, health)
    }
    if (path === LIVE_BASELINE_ENDPOINT && req.method === 'POST') {
      if (!client || !config.apiKey) return fail(res, 503, { kind: 'not-configured', message: 'The local server has no Anthropic API key (.env).' })
      let body: unknown
      try {
        body = await readJson(req)
      } catch (err) {
        if (err instanceof BadRequest) return fail(res, 400, { kind: 'bad-request', message: err.message, problems: [err.message] })
        throw err
      }
      const problems = baselineRequestProblems(body)
      if (problems.length) return fail(res, 400, { kind: 'bad-request', message: 'Invalid baseline request', problems })
      const scenario = publicScenario((body as { scenarioId: string }).scenarioId)!
      const outcome = await askBaseline(client, { model: config.model, apiKey: config.apiKey, timeoutMs: config.upstreamTimeoutMs }, scenario)
      return send(res, outcome.status, outcome.body)
    }
    return fail(res, 404, { kind: 'bad-request', message: `No route for ${req.method} ${path}` })
  }

  return createServer((req, res) => {
    const started = performance.now()
    res.on('finish', () => log(`${req.method} ${req.url} → ${res.statusCode} in ${Math.round(performance.now() - started)} ms`))
    route(req, res).catch((err: unknown) => {
      log(`Unhandled server error: ${err instanceof Error ? err.name : 'unknown'}`)
      if (!res.headersSent) fail(res, 500, { kind: 'server', message: 'The local server failed while handling the request.' })
      else res.end()
    })
  })
}
