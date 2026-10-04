/** Default model when `ANTHROPIC_MODEL` is unset. Override it in `.env`. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
export const DEFAULT_SERVER_PORT = 8787

export interface ServerConfig {
  /** Never logged, never sent to the browser. */
  apiKey: string | null
  model: string
  /** Set only to point the SDK at a stub (tests, manual proof). */
  baseURL: string | null
  port: number
  upstreamTimeoutMs: number
}

const clean = (value: string | undefined) => (value && value.trim() !== '' ? value.trim() : null)

export function readConfig(env: Record<string, string | undefined>, upstreamTimeoutMs: number): ServerConfig {
  const port = Number(clean(env.FALSIFYBENCH_SERVER_PORT) ?? DEFAULT_SERVER_PORT)
  return {
    apiKey: clean(env.ANTHROPIC_API_KEY),
    model: clean(env.ANTHROPIC_MODEL) ?? DEFAULT_ANTHROPIC_MODEL,
    baseURL: clean(env.ANTHROPIC_BASE_URL),
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_SERVER_PORT,
    upstreamTimeoutMs,
  }
}

/** Startup line: says whether a key is set, never what it is. */
export function describeConfig(config: ServerConfig): string {
  return [
    `Anthropic key: ${config.apiKey ? 'configured' : 'missing (live agent stays unavailable)'}`,
    `model: ${config.model}`,
    `base URL: ${config.baseURL ?? 'Anthropic default'}`,
  ].join(' · ')
}
