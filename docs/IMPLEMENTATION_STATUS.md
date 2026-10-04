# FalsifyBench implementation status: mocks vs real, with MoSCoW

This page lists what is real, what is mocked or stubbed, and what has to happen to make the mocks real, and puts a MoSCoW priority on every capability. It was last audited against `main` @ `afd3d62`; line numbers refer to that commit. [`PIPELINE.md`](PIPELINE.md) says what a run does today and [`SCORE.md`](SCORE.md) defines the score; this page tracks the gap to a non-mock benchmark. The About page roadmap (`ROADMAP` and `SCIENCE_AGENT_THEMES` in `src/config/landing.ts`) must agree with it. When a mock becomes real, move its row in the same PR.

## TL;DR

The app's machinery is real: the state machine, scoring maths, receipt validation, data gates, unseal timeout, run log and score generator are all production-quality and tested. Everything that a benchmark actually measures is mocked:

1. what the agents say,
2. how they are graded,
3. where the scenarios come from.

The biggest structural issue: the **guarded agent's answer and both agents' rubric scores live inside the sealed evaluation**. In the PoC the grading truth and the thing being graded sit in one hand-written file. Before a real agent can plug in, those have to be split apart.

Also, the PoC ships as a static site on devinapps.com with no server. Live agents need keys held on a server, so **a backend is the prerequisite** for most of what's below.

---

## 1. Inventory

### A. Mocked / stubbed (product behaviour)

| # | What | Where | How it's faked today | Real version |
|---|---|---|---|---|
| M1 | **Baseline agent response** | `src/data/mat001.ts:73`, `src/data/ei001.ts:65` (`baseline`) | Hand-written `AgentResponse` (verdict, confidence, claim, rationale, next action). Labelled `Baseline agent (simulated)` | A server-side model call: render the evidence into a prompt, then parse the output into a structured `AgentResponse` |
| M2 | **Guarded agent / evidence guardrail** | `src/data/*.evaluation.ts:46-58` (`guarded`), plus `guardedAgentLabel` in the fixtures | Hand-written answer stored *inside the sealed truth*. No guardrail logic exists | A guardrail pipeline that runs over the evidence and the baseline answer: coverage check (MAT), excluding instruction-like sources (EI), and a falsification next-action. It must **not** read the sealed truth |
| M3 | **Rubric scores** (4 metrics × 2 agents) | `src/data/*.evaluation.ts:58-63` (`scoring.baseline/guarded`) | Integers assigned by hand. Only `total = round(mean)` and the delta are computed (`scoring.ts`) | A grader that computes each metric from the response against `findings`, `expectedSafeVerdict`, `sufficientNextAction` and `untrustedEvidenceIds`. Use deterministic rules where possible (e.g. `safeAction` = verdict match) and an LLM judge with a fixed rubric for the free-text metrics |
| M4 | **Scenario source** | `src/data/scenarioSource.ts` (`syntheticScenarioSource`) | Returns objects bundled into the JS. No fetch | A `ScenarioSource` that loads from an API, file store or partner feed, with runtime schema validation of the whole `Scenario` |
| M5 | **Partner validator** | `src/domain/provenance.ts:22-57` (`partnerScenarioValidator`) | A pure stub that checks only source metadata and provenance fields, and always returns `runnable: false` | A full schema check plus attestation. `runnable: true` for `partner_validated`. Must report all problems at once (existing rule) |
| M6 | **Runnable-provenance gate** | `src/domain/provenance.ts` (`isRunnableProvenance`), score gate `I2` (`benchmarkScore.ts:116`) | Only `synthetic_hand_audited` passes | Also accept `partner_validated`. Keep rejecting `partner_pending_validation` |
| M7 | **"Sealing" of the evaluation** | `scenario.evaluation.unseal()` → dynamic `import('./*.evaluation')` | Hidden only from the initial bundle and the DOM. The chunk sits in `dist/assets`, so anyone can fetch it | A server-held evaluation that is only released after the Audit stage, or (better) server-side grading that returns only the results |
| M8 | **Data mode & Agent execution selectors** | `src/components/DataModeSelector.tsx`, `UnavailableModesNote` (`App.tsx:110`) | Radios hard-coded: `checked` on synthetic/scripted, `disabled` on partner/live | Bound to state, with `DataMode` and execution mode threaded through `App` → `useWalkthrough` → the source and agent runner |
| M9 | **Receipt mode / execution** | `useWalkthrough.ts:71` (`mode: 'synthetic'`), `receipt.ts:28,61,85` | `mode` is a literal, `agentExecution: 'scripted_fixture'` is a literal type, and `createReceipt` throws for non-synthetic modes | Receipt v2: mode, `agentExecution: 'scripted_fixture' \| 'live'`, model id/version, prompt hash, params, seed, latency, grader version, partner provenance. Optionally signed and persisted |
| M10 | **Run log facts** | `src/domain/runLog.ts:82,84,98,111,116,199` | Fixed text: "public fixture bundled with the page, no fetch", "scripted fixture, no model called" | Facts taken from the actual execution: fetch URL and timing, model call id and latency, grader steps. Matches the existing "facts must state what actually happened" rule |
| M11 | **Benchmark score** | `tools/score/score.ts`, `src/domain/benchmarkScore.ts` | Scores the fixed fixture answers. With deterministic answers there's one sample and no variance | Scores recorded live runs: N samples per scenario, mean ± CI, a model/version column, and the same gates (I1–I9, S1–S2) |
| M12 | **Coming-next scenario RV-001** | `src/data/previews.ts` | Description text only | Fixture, sealed evaluation, a playbook section, `spec.rv001.test.ts`, registration in `RUNNABLE_BENCHMARKS` |
| M13 | **Evidence is read-only** | fixtures | Fixed evidence, no editing or rerun | Editable evidence, then rerun (needs M1–M3 live, because scripted answers can't react to edits) |
| M14 | **Copy & contract claims** | `provenance.ts` labels (`SCRIPTED_FIXTURE_LABEL`, `LIVE_AGENT_UNAVAILABLE_REASON`, `PARTNER_UNAVAILABLE_REASON`), `(simulated)` labels, README, `docs/SCORE.md`, `docs/PIPELINE.md`, playbook non-goals and acceptance ("No API key, live LLM call…") | States the PoC's limits truthfully | Labels per mode. The playbook's non-goals and acceptance items have to change, which needs an explicit product decision |
| M15 | **Persistence** | none | Receipts exist only in memory and the JSON download | A store for receipts and runs, needed for the score to aggregate live runs |

### B. Already real (keep as-is)

| What | Where |
|---|---|
| Five-stage state machine (manual and auto-play share transitions) | `src/domain/walkthrough.ts`, `stages.ts` |
| Totals and delta maths | `src/domain/scoring.ts` |
| Receipt construction and ordering validation, injected clock and run id | `src/domain/receipt.ts` (`systemClock`, crypto `randomRunId`) |
| Runtime data gates on the unsealed evaluation (I3–I8 + shape) | `src/domain/evaluationCheck.ts` |
| Unseal timeout (15 s) and failed-load path | `src/domain/unsealTimeout.ts`, `useWalkthrough.ts` |
| Run log structure, triggers, abandoned-run line | `src/domain/runLog.ts` |
| Benchmark score formula, integrity gates, page generator, sealed-text withholding | `src/domain/benchmarkScore.ts`, `scoreMath.ts`, `tools/score/*` |
| `ScenarioSource` / `PartnerScenarioValidator` seams and DI into `<App source deps>` | `src/domain/types.ts`, `src/App.tsx:136-141` |
| UI, error boundaries, recovery copy | `src/components/*`, `src/App.tsx` |

### C. Test-only mocks (fine, not product debt)

`vi.useFakeTimers`, a `console.error` spy, rejecting `source` props and the partner-provenance fixture in `App.test.tsx`, plus fixed clock/run-id deps in the tests. These stay.

---

## 2. What has to change to make it real

### Step 0: Decisions needed
- **Scope:** live agents, partner data, or both? Which model provider(s)?
- **Playbook:** its non-goals ("live LLM calls", "partner-data import", "persistence") and the acceptance item "No API key, live LLM call…" must be revised before any of this lands.
- **Hosting:** devinapps.com static hosting can't hold secrets. Pick a backend (e.g. a small Node/Hono or FastAPI service, serverless functions, or a Cloudflare Worker).

### Step 1: Split the data model (no behaviour change, unblocks everything)
- Move `guarded` and `scoring` **out of** `ScenarioEvaluation`. The evaluation keeps only grading truth: `hiddenTruth`, `findings`, `expectedSafeVerdict`, `sufficientNextAction`, narrative.
- Add an `AgentRunner` seam next to `ScenarioSource`: `run(agent: 'baseline' | 'guarded', scenario): Promise<AgentResponse>`. Today's scripted answers become `scriptedAgentRunner`.
- Add a `Grader` seam: `grade(scenario, evaluation, response): MetricScores`. Today's hand scores become `fixtureGrader` (a lookup).
- Update `evaluationCheck.ts`, `benchmarkScore.ts` gates (I6/I7 cover rubric and guarded-agent checks), the `spec.*.test.ts` files, `docs/PIPELINE.md` (its doc test enforces stages and labels) and `docs/SCORE.md`.
- Receipt stays v1.0 because the output is identical. Add a test that scripted output matches today's receipts byte for byte.

### Step 2: Real grader (still offline, still deterministic)
- Rules: `safeAction` comes from the verdict vs `expectedSafeVerdict`. `evidenceSufficiency` comes from coverage of the cited `findings[].evidenceIds` and from excluding `untrustedEvidenceIds`. `calibration` comes from confidence vs correctness.
- `nextTestQuality` needs semantic matching against `sufficientNextAction`: keyword/regex rules first, LLM judge later.
- Calibrate against today's hand scores (the grader should reproduce 80 / 84 within tolerance), and gate it in `npm run score`.
- This alone turns M3 from mocked into real, with no secrets needed.

### Step 3: Backend + live baseline agent
- Service endpoints: `POST /runs/:scenarioId/agents/:agent` → `AgentResponse` (structured output / JSON schema). Keys come from env vars; mock mode still needs none (existing rule).
- `liveAgentRunner` in the client calls the service. Enable the `Live agent` radio when the service is configured (`VITE_API_BASE`) and reachable.
- Run log facts come from the real call (M10). Add a timeout and an error path like the unseal one (fixed text: "Agent call failed — Retry").
- Non-determinism: the walkthrough shows one sample, and the score aggregates N.

### Step 4: Real guardrail (the guarded agent)
- Implement the guardrail as code and/or a second model pass over evidence plus the baseline answer: a high-stress coverage check (MAT pattern), detection and exclusion of instruction-like evidence (EI pattern), and a forced falsifying next action.
- It must not import the sealed evaluation, because that would be leakage. Add a test or lint rule for this.

### Step 5: Server-side sealing
- Move `*.evaluation.ts` out of the client bundle and serve it from `GET /evaluations/:id` only after the run reaches Audit. Better still, grade on the server and return the `ScenarioEvaluation` plus `MetricScores`.
- `unseal()` becomes a fetch. The existing timeout, `evaluationProblems()` and recovery paths already handle failures. The copy "Browsers cache a rejected `import()`; reload to retry" changes to a plain Retry for fetches.

### Step 6: Partner data
- Full runtime schema for `Scenario` + `ScenarioEvaluation` (e.g. zod), used by both `partnerScenarioValidator` and the synthetic source.
- `partnerScenarioSource` (API or upload), `isRunnableProvenance` accepting `partner_validated`, gate I2 widened, and the `Partner data` radio enabled.
- Receipts carry partner source metadata. The UI never shows "validated" for pending data (existing rule).

### Step 7: Receipts, persistence, scoring live runs
- Receipt v2 (fields under M9). Persist runs. `npm run score` gets a `--runs` input that scores stored live runs (N samples, CIs, per model), while the fixture score stays the gated baseline.

### Step 8: Content
- RV-001 as a third runnable scenario (M12). Editable evidence + rerun (M13) once Steps 3–4 exist.

## 3. Suggested order and rough size

| Step | Needs secrets/backend | Rough size (Devin sessions) |
|---|---|---|
| 1 Split model + seams | no | ~0.5 |
| 2 Rule-based grader | no | ~0.5–1 |
| 3 Backend + live baseline | yes | ~1 |
| 4 Guardrail | yes (if model-based) | ~1 |
| 5 Server-side sealing | backend | ~0.5 |
| 6 Partner data | backend + a real source | ~1 (blocked on a real partner source) |
| 7 Receipt v2 / persistence / live scoring | backend + store | ~1 |
| 8 RV-001, editable evidence | — | ~0.5 each |

Steps 1–2 can start now with no decisions beyond the playbook wording. Steps 3+ need the provider/hosting choice and non-production API keys, stored as Devin secrets.

---

## 4. Implementation status with MoSCoW

**Status:** Full = works for real, not a stand-in. Partial = real code with mocked inputs, or limited to the PoC. None = not built.
**MoSCoW** is the priority for the next iteration, "move mocks to real":
- **Must:** without it the benchmark measures nothing real.
- **Should:** high value, but the benchmark is credible without it.
- **Could:** nice to have.
- **Won't:** explicitly out of scope for this iteration.

Items marked Full are already done. Their MoSCoW is what they would have been, kept so the whole picture is in one place.

### Fully implemented

| Capability | Where | MoSCoW |
|---|---|---|
| Five-stage walkthrough state machine (manual = auto-play transitions; Back/Next/Reset/Select) | `src/domain/walkthrough.ts`, `stages.ts` | Must |
| Totals and delta maths (`round(mean)`, `compareScores`) | `src/domain/scoring.ts` | Must |
| Receipt construction and validation (five ordered events, injected clock/run id, refuses incomplete runs), JSON copy/download | `src/domain/receipt.ts`, `ReceiptView.tsx` | Must |
| Runtime data checks on the unsealed evaluation (shape + gates I3–I8, every problem reported at once) | `src/domain/evaluationCheck.ts` | Must |
| Unseal timeout (15 s) and failed / invalid / errored recovery paths | `unsealTimeout.ts`, `useWalkthrough.ts`, `ErrorCard` | Must |
| Benchmark score generator: formula, gates I1–I9/S1–S2, sealed-text withholding, MathML page + `score.json` | `benchmarkScore.ts`, `scoreMath.ts`, `tools/score/*` | Must |
| Run log structure: triggers, timings, `Now` line, Show steps, abandoned-run line | `src/domain/runLog.ts`, `RunLog.tsx` | Should |
| `ScenarioSource` / `PartnerScenarioValidator` seams, DI of `source`/`deps` into `<App>` | `types.ts`, `App.tsx` | Must |
| Benchmark picker, per-benchmark copy, two runnable scenarios (MAT-001, EI-001) | `BenchmarkPicker.tsx`, `scenarioSource.ts` | Must |
| Fixture-vs-playbook spec tests and pipeline doc test | `tools/score/spec.*.test.ts`, `tools/pipeline/*` | Should |
| UI design system, a11y/focus handling, error boundary | `DESIGN.md`, `src/components/*`, `App.tsx` | Should |
| Static build + deploy | `vite build`, devinapps.com | Must |
| About (landing) view with honest coverage and roadmap | `src/Root.tsx`, `src/components/Landing.tsx`, `src/config/landing.ts` | Should |

### Partially implemented (real code, mocked inputs or PoC-only)

| Capability | What's real | What's missing | MoSCoW |
|---|---|---|---|
| Rubric grading (M3) | Totals, delta, safe-verdict / unsafe-approval flags are computed | The four metric values are entered by hand; there is no grader | **Must** |
| Sealed evaluation (M7) | Lazy load, never in the pre-Audit DOM, data-checked, timeout | Shipped in `dist/`, so anyone can fetch it; not server-held | **Must** |
| Receipt mode/execution (M9) | Receipt v1.0 is complete for synthetic runs | `mode`/`agentExecution` are literals; no model, prompt or grader metadata; non-synthetic modes throw | **Must** |
| Run log agent facts (M10) | Structure and trigger facts are derived from the run | Agent/source lines are fixed "no model called / no fetch" text | **Must** (once agents are live) |
| Copy and contract docs (M14) | Truthful for the PoC | Labels, README, SCORE/PIPELINE docs and playbook non-goals assume scripted-only | **Must** |
| Benchmark score on live data (M11) | Formula and gates are real | Scores only fixed answers: one sample, no variance, no per-model view | **Should** |
| Data mode / Agent selectors (M8) | Visible, accessible, truthful "unavailable" text | Hard-coded; not bound to state or wired to a source/runner | **Should** |
| Partner validator (M5) | Checks source metadata and provenance, reports all errors | No full schema check; always `runnable:false` | **Should** |
| Runnable-provenance gate (M6) | Enforced in the app and in score gate I2 | Only accepts `synthetic_hand_audited` | **Should** |
| Scenario source (M4) | Interface + synthetic implementation | No fetch-based or partner source; no runtime schema validation of `Scenario` | **Should** |
| Scenario coverage (M12) | MAT-001, EI-001 runnable | RV-001 is a preview card only | **Could** |

### Not implemented

| Capability | MoSCoW | Note |
|---|---|---|
| Split `guarded` + `scoring` out of the sealed evaluation; `AgentRunner` and `Grader` seams | **Must** | Step 1; no secrets needed; unblocks everything else |
| Rule-based grader reproducing today's +80/+84 | **Must** | Step 2; no secrets needed |
| Backend service (holds keys, runs agents, optionally grades) | **Must** | Static hosting can't hold secrets |
| Live baseline agent (model call → structured `AgentResponse`) | **Must** | Step 3 |
| Real guardrail / guarded agent that never reads the sealed evaluation | **Must** | Step 4; core claim of the benchmark |
| Agent-call failure path (timeout, Retry, Run log facts) | **Must** | Mirrors the unseal paths |
| Server-side sealing or grading | **Must** | Step 5 |
| Receipt v2 schema | **Must** | Needed for live receipts to be honest |
| Persistence of runs/receipts | **Should** | Needed to score live runs across N samples |
| Multi-sample live scoring with confidence intervals, per model | **Should** | Step 7 |
| Full runtime schema (e.g. zod) for `Scenario` + `ScenarioEvaluation` | **Should** | Shared by the partner validator and remote sources |
| Partner-data source + enabling `partner_validated` | **Should** | Blocked on a real validated partner source |
| LLM-judge for `nextTestQuality` / free-text metrics | **Could** | Rules first; judge later |
| RV-001 runnable (fixture, evaluation, spec test, playbook) | **Could** | |
| Editable evidence + rerun | **Could** | Only meaningful once agents are live |
| Receipt signing / tamper evidence | **Could** | |
| Multiple model providers / model comparison view | **Could** | |
| Declared unknowns (each agent lists what it does not know before proposing a test) | **Could** | About roadmap; needs a new rubric input |
| Two to four cases per pack | **Could** | About roadmap; content, not code |
| RL environment (scenario as environment, rubric total as reward) | **Could** | About roadmap; only meaningful once grading is real (Step 2) |
| Bio-agent pack (assay and wet-lab protocol claims) | **Won't** (this iteration) | About roadmap: not started, no biology scenario exists |
| Lab-automation pack | **Won't** | About roadmap: not started, no equipment is controlled or simulated |
| Authentication, collaboration, dashboards, CLI/MCP, multi-agent orchestration, token telemetry | **Won't** | Playbook non-goals; out of scope for this iteration |
| Mobile-first layout | **Won't** | Playbook non-goal (desktop-first) |
| Partner file upload / import UI | **Won't** (this iteration) | Do the API/adapter first |

### MoSCoW summary for "move mocks to real"

- **Must:** the agent/grader split, the rule-based grader, a backend, the live baseline agent, a real guardrail with its failure path, server-side sealing, receipt v2, Run log facts taken from the real calls, and the copy/playbook update.
- **Should:** persistence, multi-sample live scoring, the runtime schema, fetch-based and partner scenario sources, the full partner validator and provenance gate, and selectors bound to state.
- **Could:** LLM judge, RV-001, editable evidence, receipt signing, multiple providers, declared unknowns, more cases per pack, reward signal.
- **Won't:** the playbook non-goals listed above and the lab-automation pack.

**Count: 13 capabilities fully implemented, 11 partial, 24 not implemented.**
