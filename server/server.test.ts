// @vitest-environment node
import type { AddressInfo } from 'node:net'
import { request, type Server } from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalServer } from './app'
import { readConfig, describeConfig, DEFAULT_ANTHROPIC_MODEL } from './config'
import { GUARDED_TOOL_NAME } from './prompt'
import { startAnthropicStub, STUB_MODEL, type AnthropicStub } from './stub/anthropicStub'
import { LIVE_GUARDED_ENDPOINT } from '../src/domain/live'

const FAKE_KEY = 'sk-ant-test-not-a-real-key-0123456789'
let stub: AnthropicStub
let server: Server
let base: string
const logs: string[] = []
const baselineDecision = {
  verdict: 'proceed',
  confidenceLabel: '80%',
  claim: 'The evidence supports proceeding.',
  rationale: ['EV-SALT-01 supports the claim.'],
  nextAction: 'Check EV-SALT-01 against the specification.',
}

async function listen(s: Server): Promise<string> {
  await new Promise<void>((done) => s.listen(0, '127.0.0.1', done))
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`
}
const close = (s: Server) => new Promise<void>((done) => (s.closeAllConnections(), s.close(() => done())))
const ask = (url: string, body: unknown = { scenarioId: 'EI-001' }) =>
  fetch(`${url}/api/agents/baseline`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const askGuarded = (url: string, body: unknown = { scenarioId: 'EI-001', baseline: baselineDecision }) =>
  fetch(`${url}${LIVE_GUARDED_ENDPOINT}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeAll(async () => {
  stub = await startAnthropicStub()
  server = createLocalServer(
    readConfig({ ANTHROPIC_API_KEY: FAKE_KEY, ANTHROPIC_MODEL: 'claude-sonnet-4-6', ANTHROPIC_BASE_URL: stub.url }, 300),
    (line) => logs.push(line),
  )
  base = await listen(server)
})
afterEach(() => stub.setMode('success'))
afterAll(async () => {
  await close(server)
  await stub.close()
  expect(logs.join('\n')).not.toContain(FAKE_KEY)
})

describe('config', () => {
  it('defaults the model and never prints the key', () => {
    const config = readConfig({ ANTHROPIC_API_KEY: FAKE_KEY }, 1000)
    expect(config.model).toBe(DEFAULT_ANTHROPIC_MODEL)
    expect(describeConfig(config)).toBe('Anthropic key: configured · model: claude-sonnet-4-6 · base URL: Anthropic default')
    expect(describeConfig(config)).not.toContain('sk-ant')
    expect(readConfig({ ANTHROPIC_API_KEY: '  ' }, 1000).apiKey).toBeNull()
  })
})

describe('GET /api/health', () => {
  it('reports configured without leaking the key', async () => {
    const res = await fetch(`${base}/api/health`)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ configured: true, provider: 'anthropic', model: 'claude-sonnet-4-6' })
    expect(text).not.toContain('sk-ant')
  })

  it('reports not configured, and refuses live calls, without a key', async () => {
    const keyless = createLocalServer(readConfig({ ANTHROPIC_BASE_URL: stub.url }, 300), () => {})
    const url = await listen(keyless)
    try {
      expect(await (await fetch(`${url}/api/health`)).json()).toMatchObject({ configured: false, reason: expect.stringContaining('.env') })
      const res = await ask(url)
      expect(res.status).toBe(503)
      expect((await res.json()).error.kind).toBe('not-configured')
      expect((await askGuarded(url)).status).toBe(503)
    } finally {
      await close(keyless)
    }
  })
})

describe('POST /api/agents/guarded against the Messages stub', () => {
  it('returns a guarded decision with code-applied guard rules and live-call facts', async () => {
    const res = await askGuarded(base)
    expect(res.status).toBe(200)
    const { response } = await res.json()
    expect(response).toMatchObject({
      agentLabel: `Evidence guardrail (${STUB_MODEL})`,
      verdict: 'investigate',
      confidenceLabel: '80%',
      guard: {
        untrustedSourceIds: ['EV-SUP-01'],
        openGaps: ['Not every requirement is directly measured.'],
        overrides: ['Guard rule: EV-SUP-01 contains instructions addressed to the reader, so it is treated as untrusted.'],
      },
      live: { provider: 'anthropic', model: STUB_MODEL, requestId: expect.stringMatching(/^req_stub_/), endpoint: LIVE_GUARDED_ENDPOINT },
    })
    expect(response.live.validatedFields).toEqual(['verdict', 'confidenceLabel', 'claim', 'rationale', 'nextAction', 'untrustedSourceIds', 'openGaps'])
    expect(stub.calls.at(-1)).toMatchObject({ toolChoice: { type: 'tool', name: GUARDED_TOOL_NAME }, prompt: expect.stringContaining('Baseline agent decision:') })
  })

  it('uses the public fixture guarded-agent label for a live LAB-001 response', async () => {
    const res = await askGuarded(base, { scenarioId: 'LAB-001', baseline: baselineDecision })
    expect(res.status).toBe(200)
    expect((await res.json()).response.agentLabel).toBe(`Action guard (${STUB_MODEL})`)
  })

  it('rejects a malformed baseline as a bad request before calling the provider', async () => {
    const before = stub.calls.length
    const res = await askGuarded(base, { scenarioId: 'EI-001', baseline: { ...baselineDecision, verdict: 'approve' } })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatchObject({
      kind: 'bad-request',
      message: 'Invalid guarded request',
      problems: ['baseline verdict must be one of proceed, investigate, abstain (got "approve")'],
    })
    expect(stub.calls.length).toBe(before)
  })

  it('rejects an unknown untrusted ID as invalid model output', async () => {
    stub.setMode('invalid-guard-id')
    const res = await askGuarded(base)
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatchObject({
      kind: 'validation',
      problems: ['untrustedSourceIds[0] must be an evidence ID in this scenario'],
    })
  })

  it('refuses a non-local Origin before calling the provider', async () => {
    const before = stub.calls.length
    const res = await fetch(`${base}${LIVE_GUARDED_ENDPOINT}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ scenarioId: 'EI-001', baseline: baselineDecision }),
    })
    expect(res.status).toBe(403)
    expect((await res.json()).error.message).toMatch(/Origin "https:\/\/evil\.example" is not this machine/)
    expect(stub.calls.length).toBe(before)
  })
})

describe('POST /api/agents/baseline against the Messages stub', () => {
  it('returns a validated AgentResponse with the model, request ID, latency and validated fields', async () => {
    const res = await ask(base)
    expect(res.status).toBe(200)
    const { response } = await res.json()
    expect(response).toMatchObject({
      agentLabel: `Baseline agent (live: ${STUB_MODEL})`,
      verdict: 'proceed',
      confidenceLabel: '86%',
      rationale: expect.arrayContaining([expect.stringContaining('EV-')]),
      live: { provider: 'anthropic', model: STUB_MODEL, requestId: expect.stringMatching(/^req_stub_/), endpoint: '/api/agents/baseline' },
    })
    expect(response.live.validatedFields).toEqual(['verdict', 'confidenceLabel', 'claim', 'rationale', 'nextAction'])
    expect(response.live.latencyMs).toBeGreaterThanOrEqual(0)
    const call = stub.calls.at(-1)!
    expect(call).toMatchObject({ hadKey: true, model: 'claude-sonnet-4-6', toolChoice: { type: 'tool', name: 'record_decision' } })
  })

  it('builds the prompt from the public fixture only', async () => {
    await ask(base, { scenarioId: 'MAT-001' })
    const { prompt } = stub.calls.at(-1)!
    expect(prompt).toContain('Question: ')
    expect(prompt).toContain('Evidence records:')
    for (const hidden of ['highest-stress', 'zero ultrasonic', 'expectedSafeVerdict', 'Evidence guardrail']) expect(prompt).not.toContain(hidden)
  })

  it('rejects malformed tool output with every problem listed', async () => {
    stub.setMode('malformed')
    const res = await ask(base)
    expect(res.status).toBe(502)
    const { error } = await res.json()
    expect(error).toMatchObject({ kind: 'validation', requestId: expect.stringMatching(/^req_stub_/) })
    expect(error.problems).toEqual([
      'verdict must be one of proceed, investigate, abstain (got "approve")',
      'confidenceLabel must be a non-empty string of at most 2000 characters',
      'claim must be a non-empty string of at most 2000 characters',
      'nextAction must be a non-empty string of at most 2000 characters',
      'rationale must be a list of 1–6 strings',
      'unexpected field: extra',
    ])
  })

  it.each([
    ['http-400', 400],
    ['http-500', 500],
  ] as const)('maps a provider %s to an upstream error with its status and request ID', async (mode, status) => {
    stub.setMode(mode)
    const res = await ask(base)
    expect(res.status).toBe(502)
    const { error } = await res.json()
    expect(error).toMatchObject({ kind: 'upstream', upstreamStatus: status, requestId: expect.stringMatching(/^req_stub_/) })
    expect(error.message).toMatch(new RegExp(`^Anthropic returned HTTP ${status}`))
    expect(JSON.stringify(error)).not.toContain(FAKE_KEY)
  })

  it('times out a provider that never answers', async () => {
    stub.setMode('hang')
    const res = await ask(base)
    expect(res.status).toBe(504)
    expect((await res.json()).error).toEqual({ kind: 'upstream-timeout', message: 'Anthropic did not answer within 0.3 s' })
  })

  it('rejects a bad request with every problem at once, before calling the provider', async () => {
    const before = stub.calls.length
    const res = await ask(base, { scenarioId: 'NOPE-1', prompt: 'x', key: 'y' })
    expect(res.status).toBe(400)
    expect((await res.json()).error.problems).toEqual(['scenarioId must be one of EI-001, LAB-001, MAT-001 (got "NOPE-1")', 'unexpected fields: prompt, key'])
    const notJson = await fetch(`${base}/api/agents/baseline`, { method: 'POST', body: '{' })
    expect((await notJson.json()).error).toMatchObject({ kind: 'bad-request', problems: ['body is not JSON'] })
    expect(stub.calls.length).toBe(before)
  })

  it('refuses requests addressed from or to another machine, before calling the provider', async () => {
    const before = stub.calls.length
    const raw = (headers: Record<string, string>) =>
      new Promise<{ status: number; body: string }>((done, fail) => {
        const { port } = new URL(base)
        const headersOut = { 'content-type': 'application/json', ...headers }
        const req = request({ host: '127.0.0.1', port, path: '/api/agents/baseline', method: 'POST', headers: headersOut }, (res) => {
          let body = ''
          res.on('data', (d) => (body += d))
          res.on('end', () => done({ status: res.statusCode ?? 0, body }))
        })
        req.on('error', fail)
        req.end(JSON.stringify({ scenarioId: 'EI-001' }))
      })
    const lan = await raw({ host: '192.168.1.20:5173' })
    expect(lan.status).toBe(403)
    expect(JSON.parse(lan.body).error.message).toMatch(/only answers this machine: Host "192\.168\.1\.20:5173"/)
    expect((await raw({ host: 'localhost:5173', origin: 'https://evil.example' })).status).toBe(403)
    expect((await raw({ host: 'localhost:5173', origin: 'null' })).status).toBe(403)
    expect(stub.calls.length).toBe(before)
    expect((await raw({ host: 'localhost:5173', origin: 'http://localhost:5173' })).status).toBe(200)
  })

  it('cancels the provider call when the browser abandons the request', async () => {
    stub.setMode('hang')
    const before = stub.abandoned()
    const abandon = new AbortController()
    const pending = fetch(`${base}/api/agents/baseline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'EI-001' }),
      signal: abandon.signal,
    }).catch((e: unknown) => e)
    await vi.waitFor(() => expect(stub.calls.at(-1)?.mode).toBe('hang'))
    abandon.abort()
    expect(await pending).toBeInstanceOf(Error)
    await vi.waitFor(() => expect(stub.abandoned()).toBe(before + 1), { timeout: 250 })
    await vi.waitFor(() => expect(logs.some((l) => /cancelled: the browser closed the request/.test(l))).toBe(true))
  })

  it('answers unknown routes with 404', async () => {
    expect((await fetch(`${base}/api/agents/unknown`, { method: 'POST' })).status).toBe(404)
  })
})
