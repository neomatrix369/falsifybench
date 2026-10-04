// A local stand-in for the Anthropic Messages API (POST /v1/messages). Tests and the manual proof use it; nothing here calls Anthropic.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export type StubMode = 'success' | 'malformed' | 'http-400' | 'http-500' | 'hang'
export const STUB_MODES: StubMode[] = ['success', 'malformed', 'http-400', 'http-500', 'hang']
export const STUB_MODEL = 'claude-stub-1'

export interface AnthropicStub {
  server: Server
  url: string
  setMode(mode: StubMode): void
  /** Requests seen so far: only whether a key header arrived, never the key. */
  calls: { mode: StubMode; hadKey: boolean; model: string; toolChoice: unknown; prompt: string }[]
  close(): Promise<void>
}

function decisionFor(prompt: string) {
  const ids = [...new Set(prompt.match(/\b(?:EV|LAB|MAT)-[A-Z0-9-]+\b/g) ?? [])].slice(0, 2)
  return {
    verdict: 'proceed',
    confidenceLabel: '86%',
    claim: 'The evidence supports going ahead as asked.',
    rationale: [`${ids[0] ?? 'The first record'} supports the request.`, `${ids[1] ?? 'The second record'} raises no blocking concern.`],
    nextAction: 'Proceed with the requested sign-off.',
  }
}

export function startAnthropicStub(initial: StubMode = 'success', port = 0): Promise<AnthropicStub> {
  let mode = initial
  let n = 0
  const calls: AnthropicStub['calls'] = []
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const raw = Buffer.concat(chunks).toString('utf8')
    if (req.method === 'POST' && req.url === '/__stub/mode') {
      const next = JSON.parse(raw).mode as StubMode
      if (STUB_MODES.includes(next)) mode = next
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ mode }))
    }
    if (req.method !== 'POST' || req.url !== '/v1/messages') {
      res.writeHead(404)
      return res.end()
    }
    const body = JSON.parse(raw)
    const prompt = String(body.messages?.[0]?.content ?? '')
    calls.push({ mode, hadKey: typeof req.headers['x-api-key'] === 'string' && req.headers['x-api-key'] !== '', model: body.model, toolChoice: body.tool_choice, prompt })
    const requestId = `req_stub_${String(++n).padStart(4, '0')}`
    const headers = { 'content-type': 'application/json', 'request-id': requestId }
    if (mode === 'hang') return
    if (mode === 'http-400' || mode === 'http-500') {
      const status = mode === 'http-400' ? 400 : 500
      res.writeHead(status, headers)
      return res.end(JSON.stringify({ type: 'error', error: { type: status === 400 ? 'invalid_request_error' : 'api_error', message: status === 400 ? 'stub: bad request' : 'stub: internal error' } }))
    }
    const input = mode === 'malformed' ? { verdict: 'approve', confidenceLabel: '', rationale: 'not a list', extra: 1 } : decisionFor(prompt)
    res.writeHead(200, headers)
    res.end(
      JSON.stringify({
        id: `msg_stub_${n}`,
        type: 'message',
        role: 'assistant',
        model: STUB_MODEL,
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
        content: [{ type: 'tool_use', id: `toolu_stub_${n}`, name: body.tool_choice?.name ?? 'record_decision', input }],
      }),
    )
  })
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: bound } = server.address() as AddressInfo
      resolve({
        server,
        url: `http://127.0.0.1:${bound}`,
        setMode: (next) => {
          mode = next
        },
        calls,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections()
            server.close(() => done())
          }),
      })
    })
  })
}
