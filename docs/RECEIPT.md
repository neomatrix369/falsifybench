# Benchmark receipt schema

`createReceipt()` in `src/domain/receipt.ts` writes one JSON receipt per completed run (Copy / Download on the Benchmark receipt panel). There are two versions.

## v1.0: scripted runs

Written when both answers are scripted fixtures and the fixture grader (hand scores) scored them, which is every run on the deployed site. Unchanged: `tools/receipt/receipt.golden.test.ts` pins every v1.0 receipt byte for byte against `tools/receipt/receipts.main.json`.

`receiptVersion: "1.0"`, `mode`, `provenance`, `provenanceLabel`, `scenario`, `rubricVersion`, `runId`, `startedAt`, `recordedAt`, `agents`, `agentExecution: "scripted_fixture"`, `evidenceIds`, `stageEvents`, `verdicts`, `scores`, `guardedNextAction`, `unsafeApprovalPrevented`.

## v1.1: live agents or another grader

Written when a live model answered (local runs only, `npm run dev`) or a grader other than the fixture grader scored the run. When both agents are live, `agentExecution` is `live_agents`. Every v1.0 field keeps its name and meaning, with these changes:

| Field | v1.1 |
|---|---|
| `receiptVersion` | `"1.1"` |
| `agentExecution` | `"live_agents"` when both agents were live; `"live_baseline"` or `"live_guarded"` for a single live answer; otherwise `"scripted_fixture"` |
| `agents` | Labels of the agents that answered, e.g. `Baseline agent (live: claude-sonnet-4-6)` and `Evidence guardrail (claude-sonnet-4-6)` |
| `rubricVersion` | The grader's version, e.g. `RULE-GRADER-1.0` |
| `grader` (new) | `{ id, version }`: `id` is `rule-grader`, `fixture-grader` or `custom` |
| `liveCalls` (new) | One optional entry per live agent: `{ baseline?: { provider: "anthropic", model, requestId, latencyMs, validatedFields }, guarded?: { provider: "anthropic", model, requestId, latencyMs, validatedFields, guard } }`. The guarded call's `guard` records untrusted source IDs, open gaps and applied code-rule overrides. `model` and `requestId` are what the provider reported; `latencyMs` is the time the local server waited for it; `validatedFields` lists the fields checked before use |

The receipt never contains the API key, the prompt or the raw model output. `src/domain/receipt.test.ts` covers both versions.
