import { AGENT_DECISION_FIELDS, agentDecisionProblems, toAgentDecision } from '../domain/agentResponseCheck'
import {
  LIVE_BASELINE_ENDPOINT,
  LIVE_HEALTH_ENDPOINT,
  LiveAgentError,
  type LiveErrorBody,
  type LiveFailureKind,
  type LiveHealth,
} from '../domain/live'
import type { AgentResponse, AgentRunner } from '../domain/types'
import { scriptedAgentRunner } from './scriptedAgentRunner'

type Fetch = typeof globalThis.fetch

const KINDS: LiveFailureKind[] = ['timeout', 'network', 'not-configured', 'bad-request', 'upstream', 'upstream-timeout', 'validation', 'server']

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

function errorFrom(status: number, body: unknown): LiveAgentError {
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
 * Local runs only: the baseline comes from a live model through the local server (`/api`, proxied by `vite dev`);
 * the guarded agent stays scripted until Step 4. The browser sends only the scenario ID: no prompt, evidence or key.
 */
export function createLiveAgentRunner({
  fetch = (...args) => globalThis.fetch(...args),
  guarded = scriptedAgentRunner,
  now = () => performance.now(),
}: { fetch?: Fetch; guarded?: AgentRunner; now?: () => number } = {}): AgentRunner {
  return {
    execution: 'live',
    async run(agent, scenario, options): Promise<AgentResponse> {
      if (agent === 'guarded') return guarded.run('guarded', scenario)
      const started = now()
      let res: Response
      try {
        res = await fetch(LIVE_BASELINE_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenarioId: scenario.id }),
          signal: options?.signal,
        })
      } catch (err) {
        throw new LiveAgentError({ kind: 'network', message: `Could not reach the local server: ${err instanceof Error ? err.message : String(err)}` })
      }
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw errorFrom(res.status, body)
      const problems = liveBaselineProblems(body)
      if (problems.length) {
        throw new LiveAgentError({ kind: 'validation', message: `The local server's baseline reply failed validation (${problems.length} problem${problems.length > 1 ? 's' : ''})`, httpStatus: res.status, problems })
      }
      const r = (body as { response: AgentResponse & { live: NonNullable<AgentResponse['live']> } }).response
      return {
        agentLabel: r.agentLabel,
        ...toAgentDecision(r),
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
