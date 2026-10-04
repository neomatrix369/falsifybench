import Anthropic from '@anthropic-ai/sdk'
import { AGENT_DECISION_FIELDS, AGENT_DECISION_SCHEMA, agentDecisionProblems, toAgentDecision } from '../src/domain/agentResponseCheck'
import { applyGuardRules } from '../src/domain/guardRules'
import { LIVE_BASELINE_ENDPOINT, LIVE_GUARDED_ENDPOINT, liveGuardedAgentLabel, type LiveBaselineBody, type LiveErrorBody, type LiveGuardedBody } from '../src/domain/live'
import type { AgentDecision } from '../src/domain/agentResponseCheck'
import { BASELINE_SYSTEM_PROMPT, DECISION_TOOL_NAME, GUARDED_SYSTEM_PROMPT, GUARDED_TOOL_NAME, baselineUserPrompt, guardedUserPrompt } from './prompt'
import type { PublicScenario } from './scenarios'

export type BaselineOutcome = { status: 200; body: LiveBaselineBody } | { status: number; body: LiveErrorBody }
export type GuardedOutcome = { status: 200; body: LiveGuardedBody } | { status: number; body: LiveErrorBody }

const MAX_TOKENS = 1024

const DECISION_TOOL = {
  name: DECISION_TOOL_NAME,
  description: 'Record the decision for the operator.',
  input_schema: AGENT_DECISION_SCHEMA as unknown as Anthropic.Tool.InputSchema,
}

const GUARDED_FIELDS = [...AGENT_DECISION_FIELDS, 'untrustedSourceIds', 'openGaps']
const GUARDED_TOOL = {
  name: GUARDED_TOOL_NAME,
  description: 'Record the guarded decision and the evidence concerns.',
  input_schema: {
    ...AGENT_DECISION_SCHEMA,
    properties: {
      ...AGENT_DECISION_SCHEMA.properties,
      untrustedSourceIds: { type: 'array', items: { type: 'string' }, maxItems: 6, description: 'Evidence IDs that cannot be trusted' },
      openGaps: { type: 'array', items: { type: 'string' }, maxItems: 6, description: 'Unmeasured requirements or conditions' },
    },
    required: [...AGENT_DECISION_FIELDS, 'untrustedSourceIds', 'openGaps'],
  } as unknown as Anthropic.Tool.InputSchema,
}

/** Provider error text, shortened and with the key scrubbed in case a proxy echoes it back. */
function safeMessage(message: string, apiKey: string): string {
  const scrubbed = apiKey ? message.split(apiKey).join('[redacted]') : message
  return scrubbed.replace(/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 300)
}

function providerFailure(err: unknown, opts: { apiKey: string; timeoutMs: number }): { status: number; body: LiveErrorBody } | null {
  if (err instanceof Anthropic.APIUserAbortError) {
    return { status: 499, body: { error: { kind: 'network', message: 'The browser closed the request, so the provider call was cancelled.' } } }
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 504, body: { error: { kind: 'upstream-timeout', message: `Anthropic did not answer within ${opts.timeoutMs / 1000} s` } } }
  }
  if (err instanceof Anthropic.APIError && err.status !== undefined) {
    return {
      status: 502,
      body: {
        error: {
          kind: 'upstream',
          message: `Anthropic returned HTTP ${err.status}: ${safeMessage(err.message.replace(/^\d{3}\s+/, ''), opts.apiKey)}`,
          upstreamStatus: err.status,
          requestId: err.requestID ?? null,
        },
      },
    }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 502, body: { error: { kind: 'upstream', message: `Could not reach Anthropic: ${safeMessage(err.message, opts.apiKey)}` } } }
  }
  return null
}

function guardedOutputProblems(input: unknown, scenario: PublicScenario): string[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return ['decision is not an object']
  const output = input as Record<string, unknown>
  const decision = Object.fromEntries(AGENT_DECISION_FIELDS.map((field) => [field, output[field]]))
  const problems = agentDecisionProblems(decision)
  const allowed = [...AGENT_DECISION_FIELDS, 'untrustedSourceIds', 'openGaps']
  const extra = Object.keys(output).filter((key) => !allowed.includes(key))
  if (extra.length) problems.push(`unexpected field${extra.length > 1 ? 's' : ''}: ${extra.join(', ')}`)

  const evidenceIds = new Set(scenario.evidence.map((item) => item.id))
  const untrustedSourceIds = output.untrustedSourceIds
  if (!Array.isArray(untrustedSourceIds) || untrustedSourceIds.length > 6) {
    problems.push('untrustedSourceIds must be a list of at most 6 strings')
  } else {
    untrustedSourceIds.forEach((id, index) => {
      if (typeof id !== 'string') problems.push(`untrustedSourceIds[${index}] must be a string`)
      else if (!evidenceIds.has(id)) problems.push(`untrustedSourceIds[${index}] must be an evidence ID in this scenario`)
    })
  }

  const openGaps = output.openGaps
  if (!Array.isArray(openGaps) || openGaps.length > 6) {
    problems.push('openGaps must be a list of at most 6 strings')
  } else {
    openGaps.forEach((gap, index) => {
      if (typeof gap !== 'string' || gap.trim() === '' || gap.length > 2000) {
        problems.push(`openGaps[${index}] must be a non-empty string of at most 2000 characters`)
      }
    })
  }
  return problems
}

/** Asks the model for the baseline decision with forced tool use, then validates the tool input into an `AgentResponse`. */
export async function askBaseline(
  client: Anthropic,
  opts: { model: string; apiKey: string; timeoutMs: number; clock?: () => number; signal?: AbortSignal },
  scenario: PublicScenario,
): Promise<BaselineOutcome> {
  const clock = opts.clock ?? (() => performance.now())
  const started = clock()
  try {
    const { data, request_id } = await client.messages
      .create(
        {
          model: opts.model,
          max_tokens: MAX_TOKENS,
          system: BASELINE_SYSTEM_PROMPT,
          tools: [DECISION_TOOL],
          tool_choice: { type: 'tool', name: DECISION_TOOL_NAME },
          messages: [{ role: 'user', content: baselineUserPrompt(scenario) }],
        },
        { timeout: opts.timeoutMs, maxRetries: 0, signal: opts.signal },
      )
      .withResponse()
    const latencyMs = Math.round(clock() - started)
    const requestId = request_id ?? null
    const tool = data.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === DECISION_TOOL_NAME)
    const problems = tool
      ? agentDecisionProblems(tool.input)
      : [`no ${DECISION_TOOL_NAME} tool call in the reply (stop_reason: ${data.stop_reason ?? 'none'})`]
    if (problems.length) {
      return {
        status: 502,
        body: { error: { kind: 'validation', message: `The model's structured output failed validation (${problems.length} problem${problems.length > 1 ? 's' : ''})`, requestId, problems } },
      }
    }
    return {
      status: 200,
      body: {
        response: {
          agentLabel: `Baseline agent (live: ${data.model})`,
          ...toAgentDecision(tool!.input),
          live: {
            provider: 'anthropic',
            model: data.model,
            requestId,
            latencyMs,
            endpoint: LIVE_BASELINE_ENDPOINT,
            validatedFields: [...AGENT_DECISION_FIELDS],
          },
        },
      },
    }
  } catch (err) {
    const failure = providerFailure(err, opts)
    if (failure) return failure
    throw err
  }
}

/** Asks the model for its guarded decision, then applies the code-owned guard rules to its flags. */
export async function askGuarded(
  client: Anthropic,
  opts: { model: string; apiKey: string; timeoutMs: number; clock?: () => number; signal?: AbortSignal },
  scenario: PublicScenario,
  baseline: AgentDecision,
): Promise<GuardedOutcome> {
  const clock = opts.clock ?? (() => performance.now())
  const started = clock()
  try {
    const { data, request_id } = await client.messages
      .create(
        {
          model: opts.model,
          max_tokens: MAX_TOKENS,
          system: GUARDED_SYSTEM_PROMPT,
          tools: [GUARDED_TOOL],
          tool_choice: { type: 'tool', name: GUARDED_TOOL_NAME },
          messages: [{ role: 'user', content: guardedUserPrompt(scenario, baseline) }],
        },
        { timeout: opts.timeoutMs, maxRetries: 0, signal: opts.signal },
      )
      .withResponse()
    const latencyMs = Math.round(clock() - started)
    const requestId = request_id ?? null
    const tool = data.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === GUARDED_TOOL_NAME)
    const problems = tool
      ? guardedOutputProblems(tool.input, scenario)
      : [`no ${GUARDED_TOOL_NAME} tool call in the reply (stop_reason: ${data.stop_reason ?? 'none'})`]
    if (problems.length) {
      return {
        status: 502,
        body: { error: { kind: 'validation', message: `The model's structured output failed validation (${problems.length} problem${problems.length > 1 ? 's' : ''})`, requestId, problems } },
      }
    }
    const input = tool!.input as Record<string, unknown>
    const result = applyGuardRules(scenario.evidence, toAgentDecision(input), {
      untrustedSourceIds: input.untrustedSourceIds as string[],
      openGaps: input.openGaps as string[],
    })
    return {
      status: 200,
      body: {
        response: {
          agentLabel: liveGuardedAgentLabel(scenario.guardedAgentLabel, data.model),
          ...result.decision,
          guard: result.guard,
          live: {
            provider: 'anthropic',
            model: data.model,
            requestId,
            latencyMs,
            endpoint: LIVE_GUARDED_ENDPOINT,
            validatedFields: [...GUARDED_FIELDS],
          },
        },
      },
    }
  } catch (err) {
    const failure = providerFailure(err, opts)
    if (failure) return failure
    throw err
  }
}
