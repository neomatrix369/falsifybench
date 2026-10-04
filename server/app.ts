import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import Anthropic from '@anthropic-ai/sdk'
import { agentDecisionProblems, toAgentDecision } from '../src/domain/agentResponseCheck'
import { LIVE_BASELINE_ENDPOINT, LIVE_GUARDED_ENDPOINT, LIVE_HEALTH_ENDPOINT, type LiveErrorBody, type LiveHealth } from '../src/domain/live'
import { askBaseline, askGuarded } from './anthropic'
import type { ServerConfig } from './config'
import { PUBLIC_SCENARIO_IDS, publicScenario } from './scenarios'

const MAX_BODY_BYTES = 4096
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/**
 * Only this machine may spend the key. A `vite --host` proxy or a DNS-rebinding page arrives with a non-local Host,
 * another site with a non-local Origin; both are refused before any provider call.
 */
export function nonLocalRequest(headers: IncomingMessage['headers']): string | null {
  const host = headers.host ? hostnameOf(`http://${headers.host}`) : null
  if (!host || !LOCAL_HOSTNAMES.has(host)) return `Host ${JSON.stringify(headers.host ?? '')} is not this machine`
  const { origin } = headers
  if (origin !== undefined) {
    const originHost = hostnameOf(origin)
    if (!originHost || !LOCAL_HOSTNAMES.has(originHost)) return `Origin ${JSON.stringify(origin)} is not this machine`
  }
  return null
}

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

export function guardedRequestProblems(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return ['body must be a JSON object { scenarioId, baseline }']
  const request = body as Record<string, unknown>
  const problems: string[] = []
  if (typeof request.scenarioId !== 'string') problems.push('scenarioId must be a string')
  else if (!publicScenario(request.scenarioId)) problems.push(`scenarioId must be one of ${PUBLIC_SCENARIO_IDS.join(', ')} (got ${JSON.stringify(request.scenarioId)})`)
  if (!Object.hasOwn(request, 'baseline')) problems.push('baseline must be a valid agent decision')
  else problems.push(...agentDecisionProblems(request['baseline']).map((problem) => `baseline ${problem}`))
  const extra = Object.keys(request).filter((key) => key !== 'scenarioId' && key !== 'baseline')
  if (extra.length) problems.push(`unexpected field${extra.length > 1 ? 's' : ''}: ${extra.join(', ')}`)
  return problems
}

export function createLocalServer(config: ServerConfig, log: (line: string) => void = console.log): Server {
  const client = config.apiKey
    ? new Anthropic({ apiKey: config.apiKey, ...(config.baseURL ? { baseURL: config.baseURL } : {}), maxRetries: 0 })
    : null

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    const foreign = nonLocalRequest(req.headers)
    if (foreign) return fail(res, 403, { kind: 'bad-request', message: `The local server only answers this machine: ${foreign}.` })
    if (path === LIVE_HEALTH_ENDPOINT && req.method === 'GET') {
      const health: LiveHealth = {
        configured: client !== null,
        provider: 'anthropic',
        model: config.model,
        ...(client ? {} : { reason: 'No Anthropic API key in the local server environment. Add ANTHROPIC_API_KEY to .env and restart npm run dev.' }),
      }
      return send(res, 200, health)
    }
    if (req.method === 'POST' && (path === LIVE_BASELINE_ENDPOINT || path === LIVE_GUARDED_ENDPOINT)) {
      if (!client || !config.apiKey) return fail(res, 503, { kind: 'not-configured', message: 'The local server has no Anthropic API key (.env).' })
      let body: unknown
      try {
        body = await readJson(req)
      } catch (err) {
        if (err instanceof BadRequest) return fail(res, 400, { kind: 'bad-request', message: err.message, problems: [err.message] })
        throw err
      }
      const guarded = path === LIVE_GUARDED_ENDPOINT
      const problems = guarded ? guardedRequestProblems(body) : baselineRequestProblems(body)
      if (problems.length) {
        return fail(res, 400, { kind: 'bad-request', message: guarded ? 'Invalid guarded request' : 'Invalid baseline request', problems })
      }
      const request = body as Record<string, unknown>
      const scenario = publicScenario(request.scenarioId as string)!
      const abandoned = new AbortController()
      res.on('close', () => {
        if (res.writableFinished) return
        abandoned.abort()
        log(`${req.method} ${req.url} cancelled: the browser closed the request`)
      })
      const options = { model: config.model, apiKey: config.apiKey, timeoutMs: config.upstreamTimeoutMs, signal: abandoned.signal }
      const outcome = guarded
        ? await askGuarded(client, options, scenario, toAgentDecision(request['baseline']))
        : await askBaseline(client, options, scenario)
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
