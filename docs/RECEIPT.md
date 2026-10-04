# Benchmark receipt schema

`createReceipt()` in `src/domain/receipt.ts` writes one JSON receipt per completed run (Copy / Download on the Benchmark receipt panel). There are two versions.

## v1.0: scripted runs

Written when both answers are scripted fixtures and the fixture grader (hand scores) scored them, which is every run on the deployed site. Unchanged: `tools/receipt/receipt.golden.test.ts` pins every v1.0 receipt byte for byte against `tools/receipt/receipts.main.json`.

`receiptVersion: "1.0"`, `mode`, `provenance`, `provenanceLabel`, `scenario`, `rubricVersion`, `runId`, `startedAt`, `recordedAt`, `agents`, `agentExecution: "scripted_fixture"`, `evidenceIds`, `stageEvents`, `verdicts`, `scores`, `guardedNextAction`, `unsafeApprovalPrevented`.

## v1.1: live baseline or another grader

Written when the baseline came from a live model (local runs only, `npm run dev:live`) or a grader other than the fixture grader scored the run. Every v1.0 field keeps its name and meaning, with these changes:

| Field | v1.1 |
|---|---|
| `receiptVersion` | `"1.1"` |
| `agentExecution` | `"live_baseline"` when the baseline was live, otherwise `"scripted_fixture"`. The guarded agent is always scripted until Step 4 |
| `agents.baseline` | The label of the agent that answered, e.g. `Baseline agent (live: claude-sonnet-4-6)` |
| `rubricVersion` | The grader's version, e.g. `RULE-GRADER-1.0` |
| `grader` (new) | `{ id, version }`: `id` is `rule-grader`, `fixture-grader` or `custom` |
| `liveCalls` (new) | `{ baseline?: { provider: "anthropic", model, requestId, latencyMs, validatedFields } }`, empty when no answer was live. `model` and `requestId` are what the provider reported; `latencyMs` is the time the local server waited for it; `validatedFields` lists the fields checked before use |

The receipt never contains the API key, the prompt or the raw model output. `src/domain/receipt.test.ts` covers both versions.
