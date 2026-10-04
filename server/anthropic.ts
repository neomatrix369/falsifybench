import Anthropic from '@anthropic-ai/sdk'
import { AGENT_DECISION_FIELDS, AGENT_DECISION_SCHEMA, agentDecisionProblems, toAgentDecision } from '../src/domain/agentResponseCheck'
import { LIVE_BASELINE_ENDPOINT, type LiveBaselineBody, type LiveErrorBody } from '../src/domain/live'
import { BASELINE_SYSTEM_PROMPT, DECISION_TOOL_NAME, baselineUserPrompt } from './prompt'
import type { PublicScenario } from './scenarios'

export type BaselineOutcome = { status: 200; body: LiveBaselineBody } | { status: number; body: LiveErrorBody }

const MAX_TOKENS = 1024

const DECISION_TOOL = {
  name: DECISION_TOOL_NAME,
  description: 'Record the decision for the operator.',
  input_schema: AGENT_DECISION_SCHEMA as unknown as Anthropic.Tool.InputSchema,
}

/** Provider error text, shortened and with the key scrubbed in case a proxy echoes it back. */
function safeMessage(message: string, apiKey: string): string {
  const scrubbed = apiKey ? message.split(apiKey).join('[redacted]') : message
  return scrubbed.replace(/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 300)
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
    throw err
  }
}
