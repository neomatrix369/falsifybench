// Manual proof only: `npm run stub:anthropic`, then start dev:live with ANTHROPIC_BASE_URL pointing here.
// Switch failure modes with: curl -X POST localhost:8788/__stub/mode -d '{"mode":"http-500"}'
import { startAnthropicStub, STUB_MODES, type StubMode } from './anthropicStub'

const mode = (process.env.STUB_MODE ?? 'success') as StubMode
const port = Number(process.env.STUB_PORT ?? 8788)
const stub = await startAnthropicStub(STUB_MODES.includes(mode) ? mode : 'success', port)
console.log(`Anthropic Messages stub on ${stub.url} (mode ${mode}; modes: ${STUB_MODES.join(', ')})`)
