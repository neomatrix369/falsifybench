import { AGENT_DECISION_FIELDS, agentDecisionProblems, toAgentDecision } from '../domain/agentResponseCheck'
import {
  LIVE_BASELINE_ENDPOINT,
  LIVE_GUARDED_ENDPOINT,
  LIVE_HEALTH_ENDPOINT,
  LiveAgentError,
  type LiveErrorBody,
  type LiveFailureKind,
  type LiveHealth,
} from '../domain/live'
import type { AgentResponse, AgentRunner, Scenario } from '../domain/types'

type Fetch = typeof globalThis.fetch

const KINDS: LiveFailureKind[] = ['timeout', 'network', 'not-configured', 'bad-request', 'upstream', 'upstream-timeout', 'server-outdated', 'validation', 'server']

/** Every problem with the local server's baseline reply at once; empty when it is a usable live `AgentResponse`. */
export function liveBaselineProblems(body: unknown): string[] {
  const response = (body as { response?: unknown } | null)?.response
  if (typeof response !== 'object' || response === null) return ['response: missing']
  const r = response as Record<string, unknown>
  const decision = Object.fromEntries(AGENT_DECISION_FIELDS.map((k) => [k, r[k]]))
  const problems = agentDecisionProblems(decision)
  if (typeof r.agentLabel !== 'string' || r.agentLabel.trim() === '') problems.push('agentLabel must be a non-empty string')
  const live = r.live as Record<string, unknown> | undefined
  if (typeof live !== 'object' || live === null) return [...problems, 'live: missing']
  if (live.provider !== 'anthropic') problems.push('live.provider must be "anthropic"')
  if (typeof live.model !== 'string' || live.model === '') problems.push('live.model must be a non-empty string')
  if (!(live.requestId === null || typeof live.requestId === 'string')) problems.push('live.requestId must be a string or null')
  if (typeof live.latencyMs !== 'number' || !Number.isFinite(live.latencyMs) || live.latencyMs < 0) problems.push('live.latencyMs must be a non-negative number')
  if (typeof live.endpoint !== 'string') problems.push('live.endpoint must be a string')
  const fields = live.validatedFields
  if (!Array.isArray(fields) || AGENT_DECISION_FIELDS.some((k) => !fields.includes(k))) {
    problems.push(`live.validatedFields must list ${AGENT_DECISION_FIELDS.join(', ')}`)
  }
  if (typeof r.agentLabel === 'string' && typeof live.model === 'string' && live.model && !r.agentLabel.includes(live.model)) {
    problems.push('agentLabel must name the model')
  }
  return problems
}

export function liveGuardedProblems(body: unknown, scenario: Scenario): string[] {
  const problems = liveBaselineProblems(body)
  const response = (body as { response?: unknown } | null)?.response
  if (typeof response !== 'object' || response === null) return problems
  const r = response as Record<string, unknown>
  const guard = r.guard
  if (typeof guard !== 'object' || guard === null || Array.isArray(guard)) return [...problems, 'guard: missing']
  const report = guard as Record<string, unknown>
  const evidenceIds = new Set(scenario.evidence.map((item) => item.id))
  for (const field of ['untrustedSourceIds', 'openGaps', 'overrides'] as const) {
    const values = report[field]
    if (!Array.isArray(values)) {
      problems.push(`guard.${field} must be a list of strings`)
      continue
    }
    values.forEach((value, index) => {
      if (typeof value !== 'string' || value.trim() === '') problems.push(`guard.${field}[${index}] must be a non-empty string`)
      else if (field === 'untrustedSourceIds' && !evidenceIds.has(value)) problems.push(`guard.untrustedSourceIds[${index}] must be an evidence ID in this scenario`)
    })
  }
  const live = r.live as Record<string, unknown> | undefined
  const fields = live?.validatedFields
  if (Array.isArray(fields) && ['untrustedSourceIds', 'openGaps'].some((field) => !fields.includes(field))) {
    problems.push('live.validatedFields must list untrustedSourceIds and openGaps')
  }
  return problems
}

function errorFrom(status: number, body: unknown, endpoint: string): LiveAgentError {
  if (status === 404) {
    return new LiveAgentError({
      kind: 'server-outdated',
      message: `The local server is running older code without ${endpoint}. Stop npm run dev (Ctrl+C) and start it again.`,
      httpStatus: status,
    })
  }
  const e = (body as Partial<LiveErrorBody> | null)?.error
  const kind = e && KINDS.includes(e.kind) ? e.kind : 'server'
  return new LiveAgentError({
    kind,
    message: typeof e?.message === 'string' ? e.message : `The local server answered HTTP ${status}`,
    httpStatus: status,
    upstreamStatus: typeof e?.upstreamStatus === 'number' ? e.upstreamStatus : undefined,
    requestId: typeof e?.requestId === 'string' ? e.requestId : null,
    problems: Array.isArray(e?.problems) ? e.problems.filter((p): p is string => typeof p === 'string') : [],
  })
}

/**
 * Local runs only: both agents call the local server (`/api`, proxied by `vite dev`). The browser sends only the
 * scenario ID and, for the guarded call, the validated baseline decision: no prompt, evidence or key.
 */
export function createLiveAgentRunner({
  fetch = (...args) => globalThis.fetch(...args),
  now = () => performance.now(),
}: { fetch?: Fetch; now?: () => number } = {}): AgentRunner {
  return {
    execution: 'live',
    async run(agent, scenario, options): Promise<AgentResponse> {
      if (agent === 'guarded' && !options?.baseline) {
        throw new LiveAgentError({ kind: 'bad-request', message: 'The guarded live agent requires the live baseline decision.' })
      }
      const endpoint = agent === 'guarded' ? LIVE_GUARDED_ENDPOINT : LIVE_BASELINE_ENDPOINT
      const started = now()
      let res: Response
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            scenarioId: scenario.id,
            ...(agent === 'guarded' ? { baseline: toAgentDecision(options!.baseline) } : {}),
          }),
          signal: options?.signal,
        })
      } catch (err) {
        throw new LiveAgentError({ kind: 'network', message: `Could not reach the local server: ${err instanceof Error ? err.message : String(err)}` })
      }
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw errorFrom(res.status, body, endpoint)
      const problems = agent === 'guarded' ? liveGuardedProblems(body, scenario) : liveBaselineProblems(body)
      if (problems.length) {
        const subject = agent === 'guarded' ? 'guarded agent' : 'baseline'
        throw new LiveAgentError({ kind: 'validation', message: `The local server's ${subject} reply failed validation (${problems.length} problem${problems.length > 1 ? 's' : ''})`, httpStatus: res.status, problems })
      }
      const r = (body as { response: AgentResponse & { live: NonNullable<AgentResponse['live']> } }).response
      return {
        agentLabel: r.agentLabel,
        ...toAgentDecision(r),
        ...(agent === 'guarded' ? { guard: r.guard } : {}),
        live: { ...r.live, validatedFields: [...r.live.validatedFields], roundTripMs: Math.round(now() - started) },
      }
    },
  }
}

export const liveAgentRunner = createLiveAgentRunner()

/** `GET /api/health`, or null when no local server answers (always the case on the deployed static site). */
export async function probeLiveHealth(fetchImpl: Fetch = (...args) => globalThis.fetch(...args), timeoutMs = 3000): Promise<LiveHealth | null> {
  try {
    const res = await fetchImpl(LIVE_HEALTH_ENDPOINT, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const body = (await res.json()) as Partial<LiveHealth>
    if (typeof body.configured !== 'boolean' || typeof body.model !== 'string') return null
    return { configured: body.configured, provider: 'anthropic', model: body.model, ...(body.reason ? { reason: String(body.reason) } : {}) }
  } catch {
    return null
  }
}
