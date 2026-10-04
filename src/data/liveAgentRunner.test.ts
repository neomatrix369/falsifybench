import { describe, expect, it, vi } from 'vitest'
import { LiveAgentError } from '../domain/live'
import { liveAnswer } from '../domain/liveFixtures.test-helpers'
import { ei001 } from './ei001'
import { createLiveAgentRunner, liveBaselineProblems, probeLiveHealth } from './liveAgentRunner'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const serverBody = () => {
  const { live, ...rest } = liveAnswer()
  const wire: Partial<NonNullable<typeof live>> = { ...live! }
  delete wire.roundTripMs
  return { response: { ...rest, live: wire } }
}
function runnerWith(reply: Response | Error) {
  const fetch = vi.fn(async () => {
    if (reply instanceof Error) throw reply
    return reply
  })
  let t = 0
  const runner = createLiveAgentRunner({ fetch, now: () => (t += 50) })
  return { runner, fetch }
}
async function failure(p: Promise<unknown>): Promise<LiveAgentError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(LiveAgentError)
  return err as LiveAgentError
}

describe('liveAgentRunner', () => {
  it('posts only the scenario ID and returns the validated answer with its round trip', async () => {
    const { runner, fetch } = runnerWith(json(200, serverBody()))
    const answer = await runner.run('baseline', ei001)
    expect(fetch).toHaveBeenCalledWith('/api/agents/baseline', expect.objectContaining({ method: 'POST', body: '{"scenarioId":"EI-001"}' }))
    expect(answer).toEqual(liveAnswer({ live: { ...liveAnswer().live!, roundTripMs: 50 } }))
    expect(runner.execution).toBe('live')
  })

  it('forwards the abort signal so an abandoned call is cancelled', async () => {
    const { runner, fetch } = runnerWith(json(200, serverBody()))
    const abandon = new AbortController()
    await runner.run('baseline', ei001, { signal: abandon.signal })
    expect(fetch).toHaveBeenCalledWith('/api/agents/baseline', expect.objectContaining({ signal: abandon.signal }))
  })

  it('keeps the guarded agent scripted: no request', async () => {
    const { runner, fetch } = runnerWith(json(500, {}))
    const guarded = await runner.run('guarded', ei001)
    expect(fetch).not.toHaveBeenCalled()
    expect(guarded.agentLabel).toBe('Evidence guardrail (simulated)')
    expect(guarded.live).toBeUndefined()
  })

  it('turns a server error body into a LiveAgentError with its kind, statuses and request ID', async () => {
    const { runner } = runnerWith(json(502, { error: { kind: 'upstream', message: 'Anthropic returned HTTP 500: stub', upstreamStatus: 500, requestId: 'req_x' } }))
    const err = await failure(runner.run('baseline', ei001))
    expect(err).toMatchObject({ kind: 'upstream', httpStatus: 502, upstreamStatus: 500, requestId: 'req_x', message: 'Anthropic returned HTTP 500: stub' })
  })

  it('treats a non-JSON error as a server error', async () => {
    const { runner } = runnerWith(new Response('<html>Bad gateway</html>', { status: 504 }))
    expect(await failure(runner.run('baseline', ei001))).toMatchObject({ kind: 'server', httpStatus: 504 })
  })

  it('reports an unreachable local server as a network error', async () => {
    const { runner } = runnerWith(new TypeError('fetch failed'))
    expect(await failure(runner.run('baseline', ei001))).toMatchObject({ kind: 'network', message: 'Could not reach the local server: fetch failed' })
  })

  it('rejects a reply that fails validation, listing every problem', async () => {
    const body = serverBody()
    const bad = { response: { ...body.response, verdict: 'approve', rationale: [], live: { ...body.response.live, model: '', validatedFields: [] } } }
    const { runner } = runnerWith(json(200, bad))
    const err = await failure(runner.run('baseline', ei001))
    expect(err.kind).toBe('validation')
    expect(err.problems).toEqual([
      'verdict must be one of proceed, investigate, abstain (got "approve")',
      'rationale must be a list of 1–6 strings',
      'live.model must be a non-empty string',
      'live.validatedFields must list verdict, confidenceLabel, claim, rationale, nextAction',
    ])
  })

  it('requires the agent label to name the model', () => {
    const body = serverBody()
    expect(liveBaselineProblems({ response: { ...body.response, agentLabel: 'Baseline agent' } })).toEqual(['agentLabel must name the model'])
    expect(liveBaselineProblems({})).toEqual(['response: missing'])
  })
})

describe('probeLiveHealth', () => {
  it('returns the health report from the local server', async () => {
    const fetch = vi.fn(async () => json(200, { configured: true, provider: 'anthropic', model: 'claude-sonnet-4-6' }))
    expect(await probeLiveHealth(fetch)).toEqual({ configured: true, provider: 'anthropic', model: 'claude-sonnet-4-6' })
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything())
  })

  it('returns null when nothing answers or the reply is not a health report', async () => {
    expect(await probeLiveHealth(vi.fn(async () => Promise.reject(new TypeError('fetch failed'))))).toBeNull()
    expect(await probeLiveHealth(vi.fn(async () => new Response('<!doctype html>', { status: 200 })))).toBeNull()
    expect(await probeLiveHealth(vi.fn(async () => json(404, {})))).toBeNull()
  })
})
