import type { AgentResponse, LiveCall } from './types'

/** Live model calls run only on a local machine, through the local server in `server/`. The deployed static site never makes one. */
export const LIVE_HEALTH_ENDPOINT = '/api/health'
export const LIVE_BASELINE_ENDPOINT = '/api/agents/baseline'
export const LIVE_HEALTH_RETRY_MS = 2000
/** How long the browser waits for the live baseline before it shows the timeout card. */
export const LIVE_BASELINE_TIMEOUT_MS = 30_000
/** How long the local server waits for the provider; shorter than the browser's wait so its own error arrives first. */
export const LIVE_UPSTREAM_TIMEOUT_MS = 25_000

export interface LiveHealth {
  configured: boolean
  provider: 'anthropic'
  model: string
  reason?: string
}

export const liveAvailable = (health: LiveHealth | null) => health?.configured === true

export type LiveFailureKind =
  | 'timeout'
  | 'network'
  | 'not-configured'
  | 'bad-request'
  | 'upstream'
  | 'upstream-timeout'
  | 'validation'
  | 'server'

/** Error body every non-2xx response from the local server carries. */
export interface LiveErrorBody {
  error: {
    kind: LiveFailureKind
    message: string
    upstreamStatus?: number
    requestId?: string | null
    problems?: string[]
  }
}

/** Success body of `POST /api/agents/baseline`. The browser adds `roundTripMs`. */
export interface LiveBaselineBody {
  response: Omit<AgentResponse, 'live'> & { live: Omit<LiveCall, 'roundTripMs'> }
}

export const LIVE_FAILURE_LABEL: Record<LiveFailureKind, string> = {
  timeout: `no answer within ${LIVE_BASELINE_TIMEOUT_MS / 1000} s`,
  network: 'local server unreachable',
  'not-configured': 'local server has no API key',
  'bad-request': 'request rejected by the local server',
  upstream: 'model provider returned an error',
  'upstream-timeout': 'model provider timed out',
  validation: 'model output failed validation',
  server: 'local server error',
}

export class LiveAgentError extends Error {
  readonly kind: LiveFailureKind
  readonly httpStatus?: number
  readonly upstreamStatus?: number
  readonly requestId: string | null
  readonly problems: string[]
  constructor(init: { kind: LiveFailureKind; message: string; httpStatus?: number; upstreamStatus?: number; requestId?: string | null; problems?: string[] }) {
    super(init.message)
    this.name = 'LiveAgentError'
    this.kind = init.kind
    this.httpStatus = init.httpStatus
    this.upstreamStatus = init.upstreamStatus
    this.requestId = init.requestId ?? null
    this.problems = init.problems ?? []
  }
}

/** One live baseline call in a run: asked, answered or failed. */
export type LiveBaselineCall =
  | { status: 'pending'; runId: string; attempt: number; requestedAt: string }
  | { status: 'done'; runId: string; attempt: number; requestedAt: string; settledAt: string; response: AgentResponse }
  | { status: 'error'; runId: string; attempt: number; requestedAt: string; settledAt: string; error: Error }
