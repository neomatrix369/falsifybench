# FalsifyBench documentation ↔ implementation audit

> **Dated snapshot — 2026-10-04:** findings and check results apply to revision `43cf9d390f499d419225be6c72d8badf66d9161a`, not automatically to later main revisions. Saving this report in the repository does not re-audit subsequent changes or certify a release.

Companion: [implementation status and MoSCoW inventory](IMPLEMENTATION_MOSCOW.md).

**Verdict: mostly aligned, not completely.** Fixture values, score equations, provenance gating, the five-stage walkthrough, receipts and the major error paths have matching documentation. The remaining issues are stale QA evidence, overbroad wording, and a small design-rule discrepancy—not a different benchmark implementation.

## Scope and evidence

- Audited revision: [`43cf9d390f499d419225be6c72d8badf66d9161a`](https://github.com/neomatrix369/falsifybench/commit/43cf9d390f499d419225be6c72d8badf66d9161a), matching both local `origin/main` and the remote `main` head when checked on 2026-10-04.
- All six Markdown documents tracked at the audited revision: `README.md`, `DESIGN.md`, `docs/PIPELINE.md`, `docs/QA.md`, `docs/SCORE.md`, and `docs/falsifybench-playbook.md`.
- Also checked the generated score page/JSON, package/build configuration, fixtures, domain functions, hook/UI wiring and documentation contract tests.
- The original audit phase was read-only: no tracked source, documentation or generated-artifact changes remained, and no commits, PR, deployment or saved-playbook update was made during that phase. This report was subsequently saved under `docs/`; that archival change does not resolve the findings. Build/check commands generated only ignored local outputs.
- **Limits:** no fresh browser acceptance pass, deployed-preview verification, clean dependency install or audit of the separately saved Devin playbook. Historical browser results were not treated as current evidence.

## Confirmed findings

### 1. QA evidence is historical, but the page reads like a current release review

**Impact: medium · documentation/evidence freshness.**

[`docs/QA.md:1–10`](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/docs/QA.md#L1-L10) starts with `main @ ca6b654`, an old preview and old asset hashes. It mixes passes for PRs #1–#9, #14–#17 and the score migration after #18. The audited main is the merge of #32. The 40/40, 48/48 and 84/84 counts are historical; the suite at the audited revision passes **105 tests in 12 files**.

The page already explicitly records that `npm run frs` was replaced by `npm run score`; those old command/results references are not themselves bugs. They should remain as dated history, rather than be silently rewritten as fresh results.

There are also historical assertions that must not be read as current contracts: [`QA.md:19–22`](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/docs/QA.md#L19-L22) says Reset restores fresh page text, whereas the audited main retains an abandoned-run line after a mid-run Reset. The reduced-motion row says “Auto-play off,” whereas the audited implementation still supports explicitly requested auto-play; reduced motion suppresses visual motion.

**Recommendation:** mark existing sections as historical snapshots and add a latest-revision section. Publish current deployed/browser pass claims only after actually running those checks. This also fulfils the playbook's QA-update rule at [line 22](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/docs/falsifybench-playbook.md#L22).

### 2. “No network” wording overstates what the browser run does

**Impact: medium · truthfulness/copy.**

[`README.md:32`](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/README.md#L32) says mock mode needs “no network access”; the playbook's [Run-log contract](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/docs/falsifybench-playbook.md#L99) requests “no network or model calls.” The actual [Run-log copy](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/src/domain/runLog.ts#L77-L85) repeats that claim.

However, the initial Audit lazily imports a same-origin evaluation chunk: [MAT-001](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/src/data/mat001.ts#L85-L88) and [the loading hook](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/src/hooks/useWalkthrough.ts#L29-L42). `docs/PIPELINE.md` correctly distinguishes this request from model calls.

This is **not** an external inference/API dependency. Local serving can work without Internet access after dependencies are installed. It is simply not a guarantee of zero browser requests.

**Recommendation:** consistently say “no external API, model or partner-data calls; static assets and the evaluation chunk are served from the same origin.” If claiming offline browser support, document its prerequisites rather than imply an already-loaded page always has its not-yet-requested lazy chunk available offline.

### 3. Timeout recovery is conflated with a rejected import

**Impact: medium · error recovery wording.**

[`PIPELINE.md:81–82`](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/docs/PIPELINE.md#L81-L82) maps an import rejection and a 15-second timeout to the same error card. That matches the UI, but the shared [error explanation](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/src/components/ErrorCard.tsx#L5-L10) says the browser cached a failed import and Reset alone repeats the failure. The [Run-log recovery](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/src/domain/runLog.ts#L164-L173) makes the same unconditional assertion.

[`withTimeout()`](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/src/domain/unsealTimeout.ts#L10-L24) rejects its wrapper, not the underlying import promise, and does not cancel the import. A late successful load can therefore make a subsequent attempt succeed. The hook clears its error on Reset and can invoke `unseal()` again on the next Audit.

**Verification:** a standalone shell probe using the repository's actual `withTimeout()` first timed out, then observed the original promise resolve, then successfully retried that same promise. This verifies the timeout distinction; it is not a fresh Chrome failure/recovery test.

**Recommendation:** distinguish `UnsealTimeoutError` from import rejection in documentation, error-card and Run-log explanations. Reload remains a useful option, but a timeout should not be described as proof of a cached failed import.

### 4. The published score page does not fully follow the stated design rules

**Impact: low · design documentation/scope.**

[`DESIGN.md:59–64`](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/DESIGN.md#L59-L64) rules out uppercase tracked “eyebrow” labels. The generated page's [CSS](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/tools/score/score.ts#L69-L100) defines uppercase, letter-spaced `.eyebrow`, `.stats .h`, `.eqs dt` and table headers; the [Legend heading](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/tools/score/score.ts#L121-L125) uses the eyebrow class. The emitted HTML contains this CSS.

The report also duplicates RGB tokens in its generator rather than reading the app's token definitions. The values currently agree; this is a future drift risk, not a present colour mismatch.

**Recommendation:** either bring the standalone score page under the same rules or explicitly document its exceptions. No visual redesign was performed during this audit.

## Smaller wording and contributor gaps

- **Score inputs versus file reads:** [`README.md:36`](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/README.md#L36) and `docs/SCORE.md` say the score reads only `src/data`. That accurately identifies numeric benchmark inputs, but the CLI also executes spec tests which read the playbook, and reads build assets for its font URLs. Say “agent metrics are derived only from synthetic fixture data; integrity gates also compare it with the documented spec.” This preserves the crucial distinction that code quality and git history are **not** scored.
- **Adding a scenario:** [`SCORE.md:52–54`](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/docs/SCORE.md#L52-L54) names `RUNNABLE_BENCHMARKS` but does not explicitly name the separate [`SYNTHETIC_SCENARIOS` lookup](https://github.com/neomatrix369/falsifybench/blob/43cf9d390f499d419225be6c72d8badf66d9161a/src/data/scenarioSource.ts#L5-L22). Contributors must register in both; picker registration alone is not enough for loading.
- **Browser QA reproduction:** the harness documents its startup command in `tools/qa/acceptance.py`, but the public setup docs do not explain its Python Playwright dependency, existing-Chrome CDP prerequisite or `QA_*` environment settings. A small reproducibility section would cover this code-to-doc gap. The script also reports failed assertions without setting a failing process exit status; that is a tooling caveat for any future automation, not a failing result from this audit.
- **“Sealed” scope:** current docs correctly describe absence from the initial app bundle/DOM, not server-side access control. The Run-log phrase “so nobody can read it ahead of the baseline” is stronger than code splitting guarantees. Publicly served static chunks are inspectable outside the guided UI; clarify that sealing is a presentation boundary, not a security guarantee.

## What aligns in both directions

| Document | Verified implementation counterpart | Result |
|---|---|---|
| README | Node requirement, scripts, two runnable fixtures, source map, deferred integrations | Matches, aside from wording noted above |
| DESIGN | App CSS/Tailwind tokens, self-hosted fonts, type scale, motion and focus rules | Main app matches; standalone score-page exception noted above |
| SCORE | `benchmarkScore.ts`, `scoring.ts`, generator, I1–I9 and S1–S2 | Equations, gate definitions and current values match |
| PIPELINE | State machine, loading hook, provenance, Run log, error boundaries, receipt/export | Major paths match; recovery wording needs the timeout distinction |
| Playbook | MAT-001/EI-001 fixture spec tests, UI/hook/domain contracts | Fixture values and major product contracts match; network/recovery wording needs precision |
| QA | Older revision-specific evidence | Historical record, not current-main certification |

Code-to-document coverage exists for the public source/provenance seam, manual/auto-play transitions, lazy loading, runtime validation, rejected/invalid/timed-out evaluations, reset/switch abandonment, Run-log facts, scoring and receipt JSON. Deferred live agents, validated partner data, editing/persistence, research-validity execution and mobile optimisation are explicitly scoped out; they are not missing implemented promises.

The pipeline contract test checks stage order, action/trigger/status names and fixed Run-log labels. The fixture spec tests check selected identity, evidence, verdict/action and score fields. **These tests prevent some drift, not every semantic error in prose or every UI behaviour.** Their passing results do not establish that all documentation claims are true.

## Checks actually executed at the audited revision

Using **Node 20.20.2 / npm 10.8.2**, with the existing dependency installation:

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed: 105 tests, 12 files |
| Pipeline documentation contract | Passed within the suite: 5 tests |
| Fixture-vs-playbook specs | Passed: 27 checks |
| `npm run score` | Passed: G = 1; guarded 94.5, baseline 12.5, mean delta +82 |
| `npm run build` | Passed: Vite production build completed |
| Local Markdown file-link targets | All resolve; external URLs/heading anchors not exhaustively validated |
| Initial production JS sealed-marker scan | None of the four checked sealed markers present |
| Standalone timeout probe | Passed: underlying promise survives wrapper timeout and later retry succeeds |
| Final `git status --short` | Clean |

Score fingerprint: **`sha256:653dfc05fe66`**. MAT-001 totals are **15 → 95 (+80)**; EI-001 **10 → 94 (+84)**. Guarded safe verdicts **2/2**, baseline **0/2**; both baseline unsafe approvals are prevented.

## Recommended follow-up

1. Focused documentation/UI-copy cleanup for network and timeout explanations; clarify score inputs, scenario registration and score-page design scope.
2. Refresh QA only after a fresh browser/deployment verification, keeping prior evidence as dated history.
3. Add targeted tests for recovery distinctions and an explicit score-artifact freshness check if these become release requirements.

No core scoring-formula or fixture correction is indicated by this audit. No release approval is implied by the old QA page or by passing unit/DOM checks.
