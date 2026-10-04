# FalsifyBench run pipeline: input → process → output

This page follows one benchmark run from its inputs to every way it can end: complete, interrupted, failed or errored. Each step names its source file. The playbook (`docs/falsifybench-playbook.md`) says what the app must do. This page says what the code does now, including the gaps. `tools/pipeline/pipeline.doc.test.ts` fails if a stage, action, trigger, status or Run log label in the code goes missing from this page.

Nothing in a run goes over the network except the sealed evaluation chunk (same origin), and no model is called. Outside a run, the About view fetches the published `score/score.json`, also same origin.

## Map

```mermaid
flowchart LR
  subgraph IN[Inputs]
    IN0[IN-0 About / Benchmark view]
    IN1[IN-1 Benchmark picker]
    IN2[IN-2 Public fixture]
    IN3[IN-3 Sealed evaluation module]
    IN4[IN-4 User controls]
    IN5[IN-5 Clock and run ID]
  end
  P0[P0 Load scenario] --> P1[P1 Provenance gate]
  P1 --> S1[S1 Evidence loaded] --> S2[S2 Baseline decided] --> S3[S3 Evidence audit] --> S4[S4 Guarded verdict] --> S5[S5 Receipt recorded]
  IN0 -. shows or hides the benchmark .-> OUT1
  IN1 --> P0
  IN2 --> P0
  IN3 -. unseal at Audit .-> S3
  IN4 --> S1
  IN5 --> S1
  P0 -- rejects --> E0[E0 Load error]
  P1 -- not synthetic --> E1[E1 Not runnable]
  S3 -- import rejects --> E3a[E3a Unseal rejected]
  S3 -- no answer in 15 s --> E3b[E3b Unseal times out]
  S3 -- bad data --> E4[E4 Invalid evaluation]
  S1 & S2 & S3 & S4 -- Reset / switch --> I2[I2 Run abandoned]
  S5 --> OUT3[OUT-3 Receipt JSON v1.0]
  S1 & S2 & S3 & S4 & S5 --> OUT1[OUT-1 Result surface]
  S1 & S2 & S3 & S4 & S5 --> OUT2[OUT-2 Run log]
```

## Inputs

| | Input | Where | Notes |
|---|---|---|---|
| IN-0 | About / Benchmark view | `Root` in `src/Root.tsx`, the header view switch in `Header`, `Landing` | A first visit in a tab opens About. `Open the benchmark` or the header `Benchmark` button switches view and sets `falsifybench-intro-dismissed` in `sessionStorage`, so later loads in that tab open the benchmark; `#about` always opens About. `App` stays mounted (hidden) under About, so the scenario loads at page load and nothing pauses a run in progress, auto-play included: it is still there on return. About reads `score/score.json` (with a fallback message if it cannot be read) and the public fixtures, never a sealed evaluation. |
| IN-1 | Benchmark picker | `RUNNABLE_BENCHMARKS` in `src/data/scenarioSource.ts` | EI-001 (default), LAB-001 or MAT-001, in that order. Selecting sets `activeId` in `App`, which reloads the scenario and remounts `Bench` (`key = <scenario.id>:<attempt>`), discarding any run in progress. |
| IN-2 | Public fixture | `src/data/ei001.ts`, `src/data/lab001.ts`, `src/data/mat001.ts` | Bundled with the page: id, version, question, `brief`, provenance, `evidence[]`, regions (MAT-001), pre-audit `narrative`, `baseline` response, `baselineTurns` (LAB-001), `guardedAgentLabel`, `evaluation.unseal()`. Safe to show before Audit. |
| IN-3 | Sealed evaluation module | `src/data/<id>.evaluation.ts` | Its own lazy chunk, fetched by dynamic `import()` only when a run reaches Audit: `hiddenTruth`, `findings`, `expectedSafeVerdict`, `guarded` response, `guardedBasis` (public evidence IDs the guarded decision relies on), optional `turns` (LAB-001), `scoring`, audit/guarded narrative. Never in the DOM or main bundle before Audit. |
| IN-4 | User controls | `walkthroughReducer` in `src/domain/walkthrough.ts` | Actions below. The trigger of each stage event is kept in `state.triggers`. |
| IN-5 | Clock and run ID | `WalkthroughDeps` (`systemClock`, `randomRunId`) | Injected; tests pass fixed values, which is how manual and auto-play runs are shown to give identical receipts. |

### Walkthrough actions

| Action | Sent by | Effect |
|---|---|---|
| `START` | Run benchmark | New `runId`, `startedAt`, stage event 1 (trigger `run`), status `active` |
| `NEXT` | Next step (`source: 'manual'`) or the 3 s auto-play tick (`source: 'auto'`) | Moves the cursor; adds a stage event only past the furthest stage reached |
| `BACK` | Back | Cursor only; auto-play off |
| `SELECT` | Stage trace step or final-state tab | Cursor only; auto-play off |
| `AUTOPLAY_ON` | Auto-play | When idle, or complete at Receipt: starts a fresh run (trigger `autoplay-start`) and ticks. Otherwise resumes ticking from the current stage |
| `AUTOPLAY_OFF` | Auto-play, manual navigation, unseal failure | Stops ticking |
| `RESET` | Reset, error card | Back to `initialWalkthroughState` |

Stage triggers recorded per event: `run`, `manual`, `autoplay-start`, `autoplay-tick`. Walkthrough status: `idle` → `active` → `complete`.

## Stages

| | Stage | Triggered by | Input | Processing | Output | If interrupted / fails | Code |
|---|---|---|---|---|---|---|---|
| P0 | Load scenario | Page open, picker | `activeId` | `source.loadScenario(id)`; cancelled if the picker changes again | `Scenario`, or E0 | E0 | `src/App.tsx` |
| P1 | Provenance gate | Load resolved | `provenance.status` | `isRunnableProvenance()`: only `synthetic_hand_audited` passes | `Bench` mounted, idle: `ScenarioCard` shows the question and the "What’s being tested" brief (`scenario.brief`: Agent, Task, What it sees, FalsifyBench checks) | E1 | `src/domain/provenance.ts` |
| S1 | Evidence loaded | Run benchmark, Auto-play | `evidence[]`, clock, run ID | `START` or `AUTOPLAY_ON`: idle → active, event 1 | Evidence cards (EI-001 shows the injected excerpt verbatim); Run log `Run … started`, `Evidence loaded` | I1, I2, I3 | `src/domain/walkthrough.ts` |
| S2 | Baseline decided | Next step, auto-play tick | `scenario.baseline` (scripted) | `NEXT`: event 2, not graded yet | Baseline card (Proceed for all three benchmarks); LAB-001 also lists its `baselineTurns`, untagged until the guarded stage | I1, I2, I3 | `src/domain/walkthrough.ts` |
| S3 | Evidence audit | Next step, auto-play tick | Sealed chunk | Event 3, then `scenario.evaluation.unseal()`; Next step held (`aria-disabled`) and auto-play paused while pending, for at most `UNSEAL_TIMEOUT_MS` (15 s); result cached for this `Bench` so a re-run after Reset makes no new request | Findings; excluded sources struck out as `Excluded · <reason>` (`instruction` by default, `stale state` for LAB-001); bracket schematic (MAT-001) or source audit | E3a, E3b, E4 | `src/hooks/useWalkthrough.ts` |
| S4 | Guarded verdict | Next step, auto-play tick | `evaluation.guarded`, `evaluation.guardedBasis`, `evaluation.turns`, `evaluation.scoring` | Event 4; `compareScores()` → `totalScore() = round(mean of 4 metrics)`, each an integer 0–100 or `RangeError` | Outcome strip; both responses; basis line `Decided from public evidence: <guardedBasis>. The answer key is used only to grade`; turn trace (`TurnTrace`) only when `evaluation.turns` exists (LAB-001): baseline and guarded turns tagged `productive` Productive, `wasted` Wasted, `rectification` Rectification or `unsafe` Unsafe, guard turns marked; score card, score equations, Run log formulas | E4 | `src/domain/scoring.ts` |
| S5 | Receipt recorded | Next step, auto-play tick | Everything above | Event 5; `createReceipt()` checks mode `synthetic`, 5 events, order 1–5 (`IncompleteRunError` otherwise) | `BenchmarkReceipt` v1.0; status `complete` | E6 | `src/domain/receipt.ts` |

## Every way a run ends

| Path | Ends at | User sees | Record left | Status |
|---|---|---|---|---|
| Complete (manual or auto-play) | S5 | Receipt panel | Run log + receipt JSON | Covered |
| I1 Back / stage tab, then continue | S5 | Earlier stage, replayed without new events | Same as complete | Covered |
| Re-run after complete or Reset | S5 | New run; Audit reuses the cached evaluation | Run log says it is reusing it | Covered |
| E0 Scenario load fails | P0 | Full-page error card; Reset returns to the default benchmark (`initialId`, which defaults to `DEFAULT_BENCHMARK_ID`, EI-001) and reloads the page if already there | Message on screen only | Covered |
| E1 Not runnable (partner provenance) | P1 | Error card `<id> is not runnable: Awaiting validated partner source.` | Message on screen only | Covered (not reachable from the UI today) |
| E3a Unseal rejected | S3 | Error card with `Reload page` and `Reset walkthrough`; browsers cache the failed `import()`, so only a reload retries | Run log `Sealed evaluation failed to load` with Error, Effect, Recovery | Covered |
| E3b Unseal does not settle in 15 s | S3 | After `UNSEAL_TIMEOUT_MS` an error card: `did not load within 15 s`, with `Reload page` and `Reset walkthrough`; `unsealRecovery()` returns `retry`, because the slow `import()` can still arrive, so Reset retries it (unlike E3a); auto-play off | Run log `Sealed evaluation failed to load` with `UnsealTimeoutError` and a Reset-retries Recovery fact, never left pending | Covered |
| E4 Invalid evaluation data | S3 | Error card: `evaluationProblems()` runs data gates I3–I8 on the unsealed evaluation and it is not used. `Reset walkthrough` only, since reload and Reset load the same data | Run log `Sealed evaluation failed its data checks` with each failed check, Effect and Recovery | Covered |
| E5 Render error | Any | Error card from `WalkthroughErrorBoundary`: one around the result panel (clears when `runId` changes) and one around the whole `Bench` in `App`, whose Reset remounts it | Console | Covered |
| E6 Receipt export fails | S5 | `Clipboard unavailable — use Download.` | Receipt still downloadable | Covered |
| I2 Reset or switch benchmark mid-run | S1–S4 | Idle `Ready` (on the other benchmark after a switch) | One Run log line from `abandonedEntry()`: run ID, stage reached, benchmark and cause, no receipt. It stays until the next run starts | Covered |
| I3 Auto-play pauses | Any | Stops on manual navigation, unseal failure or Receipt; pauses while unsealing | — | Covered |
| I4 Visit About mid-run | Any | About page; on return the run is where it was, or further on if auto-play kept ticking | Run log unchanged | Covered |

## Outputs

| | Output | Where | Notes |
|---|---|---|---|
| OUT-1 | Result surface and stage trace | `ResultSurface`, `StageTrace`, `ScenarioCard`, `TurnTrace` | On screen only, nothing persisted. `ScenarioCard` carries the "What’s being tested" brief for every benchmark. Baseline turns `warning` once Audit is reached. |
| OUT-2 | Run log | `buildRunLog()` in `src/domain/runLog.ts`, `RunLog` | Per entry: trigger, inputs, steps, output; live `Now` line. Covers START to Receipt plus the unseal pending/failed entries. The `Guarded verdict` entry lists `Decided from` (public evidence only: the `guardedBasis` IDs; the answer key grades the result and is not an input to either agent) and, when `evaluation.turns` exists, `Turns` (the baseline and guarded turn kinds in order, guard turns marked `(guard)`). Not exportable. Reset or a switch mid-run clears it, leaving one line naming the abandoned run and the stage it reached. |
| OUT-3 | Benchmark receipt JSON v1.0 | `createReceipt()`; Copy / Download `falsifybench-<id>-<runId>.json` | Completed runs only. Triggers, unseal timing, errors, the evidence basis and the turn trace stay out on purpose so the v1.0 schema does not change. |

### Run log entry labels

`Run <runId> started` · `Evidence loaded` · `Baseline decided` · `Audit started` · `Waiting for sealed evaluation…` · `Sealed evaluation loaded` · `Sealed evaluation failed to load` · `Sealed evaluation failed its data checks` · `Guarded verdict: <verdict>` · `Receipt recorded` · `Run <runId> abandoned at stage <n> <stage>`

Facts added to `Guarded verdict` for the evidence basis and turn trace: `Decided from` (every benchmark) · `Turns` (only when `evaluation.turns` exists, LAB-001 today).

## Offline pipelines (not part of a browser run)

| Pipeline | Input | Output |
|---|---|---|
| Dev checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | Source | Pass/fail, local only (the repo has no CI) |
| Data benchmark score: `npm run score` (`docs/SCORE.md`) | Synthetic fixtures + sealed evaluations | `public/score/index.html`, `score.json`: `G × mean T`, safe-verdict and unsafe-approval rates, mean delta |

## Known gaps

None open.

When a gap is fixed, move its row in "Every way a run ends" to Covered and delete it here.
