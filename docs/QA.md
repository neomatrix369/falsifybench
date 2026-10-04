# QA / release review

Read-only acceptance review of FalsifyBench against the playbook's **Acceptance checklist**, **Product truthfulness rules**, **Guided walkthrough** and **Data and code contracts** (`docs/falsifybench-playbook.md`).

- **Revision:** `main` @ `ca6b654` (PRs #1–#9). First pass was at `30183f9` (PRs #1–#6); this pass adds #7 (EI-001 injected line at every stage, FRS EI-001 scoring) and #8 (dev dependency guard).
- **Targets:** deployed preview <https://dist-goqefkae.devinapps.com> and a local `npm run preview` of the same revision. Every deployed asset (`index-C8Ew7kIl.js`, `index-CZlkLA_X.css`, both evaluation chunks, `index.html`, `frs/index.html`) is byte-identical to a local build.
- **Runtime:** Node 20.20.2. Browser checks drove Chrome over CDP with `playwright-core` (DOM, accessibility snapshot, page source, focus, clipboard, downloads, request log, emulated `prefers-reduced-motion`).
- **Result:** all items pass on both targets; no open failures.
- **Run-log trace pass (PRs #14–#17):** browser checks on a local Vite build of PR #15 (`e1cc7e4`), then a spot-check of the #16 fixes on `main` @ `3d84f56`, desktop Chrome at 1280 CSS px. `main` @ `c76a92c`: lint, typecheck, 48/48 tests, build, `npm run frs` SHIP 0.9913 (no gate, acceptance or alignment failures). Results are in [Run log trace](#run-log-trace); F6–F7 are below.
- **After #18 (`npm run frs` replaced by `npm run score`):** `main` @ `97662b7` merged with this branch: lint, typecheck, 84/84 tests, build and `npm run score` pass (G = 1; guarded 94.5, baseline 12.5, mean delta +82).
- **EI-001 default and LAB-001 pass (PR #39 branch @ `98ecb13`):** `tools/qa/acceptance.py` on a local `vite preview` build, desktop Chrome over CDP at 1280 CSS px: 72/72 pass. Not run against a deployed preview. The benchmark now opens on EI-001, so row 1 below records the earlier MAT-001 default. Results are in [Acceptance script](#acceptance-script) and [LAB-001](#lab-001-stale-robot-arm-state).
- **Deployed pass (`main` @ `7c805a7`, PRs through #39):** `tools/qa/acceptance.py` against <https://deploy-main-dist-nweflryx.devinapps.com> on 2026-10-04, after confirming the live `index-CZoUusoP.js` matches a local build of the same revision: 72/72 pass, exit 0. Locally on that revision: lint, typecheck, 131/131 tests, build, `npm run score` (all gates pass).

## Checklist

| # | Check | Deployed | Local |
|---|---|---|---|
| 1 | Default screen is MAT-001, labelled `Synthetic · hand-audited` | Pass | Pass |
| 2a | Back disabled at Evidence; Next step disabled at Receipt | Pass | Pass |
| 2b | Run benchmark disabled during a walkthrough (manual and Auto-play) | Pass | Pass |
| 2c | Reset returns to the initial state (page text equals a fresh load) | Pass | Pass |
| 2d | Back, Next, Pause auto-play, trace selection and Reset each pause Auto-play | Pass | Pass |
| 2e | Auto-play advances every 3 s (measured 3.0–3.1 s) and stops at Receipt | Pass | Pass |
| 2f | `prefers-reduced-motion`: Auto-play off, no smooth scroll, transitions ≈ 0 s | Pass | Pass |
| 3 | Manual and Auto-play: identical stages, headlines, verdicts, metrics and receipt (ignoring run ID and timestamps), for MAT-001 and EI-001 | Pass | Pass |
| 4 | Before Audit, `highest-stress` / `zero ultrasonic` absent from DOM, accessibility tree, page source, Run log and main bundle (also with disclosures expanded and after Reset); the evaluation chunk is first requested at Audit | Pass | Pass |
| 4b | At Audit, both phrases appear with the R4 explanation; R4 shows `No readings` | Pass | Pass |
| 5 | Guarded `Investigate` at 84%, targeted ultrasonic inspection of R4; totals 15 / 95, delta +80, `Unsafe approval prevented` | Pass | Pass |
| 6 | Receipt: provenance, run ID, recorded-at, mode, `EV-UT-01`, `EV-IMG-01`, `EV-ALLOY-01`, `EV-MAINT-01`, `EV-COV-01`, `MAT-RUBRIC-1.0`, `MAT-001 · v1.0`, all metrics and +80 | Pass | Pass |
| 6b | Copy JSON, Download JSON and the raw view are identical | Pass | Pass |
| 7 | Partner data and Live agent visible but disabled, with truthful explanations; clicking does not select them | Pass | Pass |
| 8 | Only same-origin static requests; no API/LLM calls; no console errors; no keys, `.env` files or env access in the repo; no partner claims | Pass | Pass |
| 9 | Keyboard only: every control, the benchmark picker, scenario previews and Return to MAT-001; focus never drops to `<body>` (including the first-run step into Audit while the sealed chunk loads) | Pass | Pass |
| 10 | `npm install`, `lint`, `typecheck`, `test` (40/40), `build`, `preview` on Node 20 | — | Pass |

### EI-001 (prompt-injected source)

| # | Check | Deployed | Local |
|---|---|---|---|
| E1 | Sealed audit text absent before Audit; `ei001.evaluation` chunk fetched only at Audit; the injected supplier note is shown as received | Pass | Pass |
| E2 | Baseline `Proceed` 90%, guarded `Investigate` 88%; totals 10 / 94, delta +84; receipt has `EI-001 · v1.0` and EV-SALT-01, EV-SPEC-01, EV-FIELD-01, EV-LIT-01, EV-SUP-01 | Pass | Pass |
| E3 | Switching benchmarks mid-run resets to Not started and focuses the new scenario heading | Pass | Pass |
| E4 | The `EV-SUP-01` verbatim quote is visible at every stage; `Excluded · instruction` appears only from Audit on and is cleared by Reset | Pass | Pass |

### LAB-001 (stale robot-arm state)

| # | Check | Deployed | Local |
|---|---|---|---|
| M1 | LAB-001 selectable; its `What’s being tested` brief is shown | — | Pass |
| M2 | `stale state`, `−78`, `never acknowledged` and `Decided from public evidence` absent from DOM and accessibility tree at idle, Evidence and Baseline | — | Pass |
| M3 | Baseline `Proceed` 92% | — | Pass |
| M4 | At Audit the source audit marks `EV-OP-01` `Excluded · stale state` | — | Pass |
| M5 | Guarded `Investigate`, `95% confidence the commanded move is unsafe`, `Retract to Z = +5 mm`; `Decided from public evidence` with `EV-TEL-01 · EV-PROT-04 · EV-LOG-01 · EV-DECK-01`; turn tags `Rectification` and `Unsafe` | — | Pass |
| M6 | Receipt has `LAB-001`, `MAT-RUBRIC-1.0` and EV-PROT-04, EV-OP-01, EV-TEL-01, EV-LOG-01, EV-DECK-01 | — | Pass |
| M7 | Run log Guarded entry records `Decided from` with `EV-TEL-01, EV-PROT-04, EV-LOG-01, EV-DECK-01` and `not an input`, and `Turns` with `unsafe` and `rectification (guard)` | — | Pass |
| M8 | Reset re-seals the audit truth | — | Pass |

### Run log trace

| # | Check | MAT-001 | EI-001 |
|---|---|---|---|
| R1 | Manual run to Receipt: one entry per stage, each with a trigger (`Run benchmark`, `Next step`) and an elapsed offset | Pass | Pass |
| R2 | Auto-play: countdown 3 → 2 → 1, entries say `Auto-play tick`, stops at Receipt | Pass | Pass |
| R3 | Newest entry opens on its own; per-entry Show/Hide steps; Expand all / Collapse all | Pass | Pass |
| R4 | `Now` line matches the state (waiting for Next step, countdown, unsealing, reviewing, complete); entries for the viewed stage are highlighted | Pass | Pass |
| R5 | Before Audit, no sealed text in the log, with every entry expanded; Next step is held while the evaluation loads | Pass | Pass |
| R6 | Guarded entry shows the score working (MAT `95 − 15 = +80`, EI `94 − 10 = +84`) | Pass | Pass |
| R7 | Receipt entry: mode, five stage events in order, and each clause of the unsafe-approval rule checked against the actual verdicts | Pass | Pass |
| R8 | Re-run after Reset: Audit says the evaluation is reused, with no new request, and still lists the findings | Pass | Pass |
| R9 | Unseal results show `Produced by`; a failed load shows the error, its effect and recovery | Pass | Pass |
| R10 | Reset clears the log and starts a new run ID; keyboard focus holds; no horizontal overflow at 1280 px | Pass | Pass |

### Local tooling

| # | Check | Result |
|---|---|---|
| T1 | `predev` (`tools/check-deps.mjs`) passes on a clean install, fails fast with a reinstall hint when a package is missing or its `main` entry is missing, and `npm run dev` then starts | Pass |

### Acceptance script

`tools/qa/acceptance.py` drives the existing Chrome over CDP. Run `npm run build && npx vite preview --port 4173`, then `QA_URL=http://localhost:4173/ python3 tools/qa/acceptance.py`.

- Every page it opens sets sessionStorage `falsifybench-intro-dismissed`, so the benchmark view opens instead of the About intro.
- **A0 / A0b:** the benchmark view opens on EI-001 (`aria-pressed`) with its `What’s being tested` brief, and the picker order is EI-001, LAB-001, MAT-001.
- **A–K (MAT-001):** the script then selects MAT-001 for the initial screen (A1–A11), manual run (B), trace focus (C), tab arrow keys (D), Reset (E), Auto-play timing and identical receipts (F), manual navigation stopping Auto-play (G), reduced motion (H), the Coming next card (I), a keyboard-only run (J), 1440 px overflow (K), and no third-party requests (N).
- **L (EI-001):** the EI-001 checks above (E1–E4). Set `QA_EI=0` to skip; default `1`.
- **M (LAB-001):** the LAB-001 checks above (M1–M8). Set `QA_LAB=0` to skip; default `1`.
- Other env: `QA_CDP` (default `http://localhost:29229`), `QA_SHOTS` (screenshots, default `qa-shots`), `QA_OUT` (results JSON, default `qa-accept.json`). It prints `TOTAL <n> FAIL <n>`.

## Failures found and fixed during review

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| F1 | Medium | `npm test` crashed on Node 20 (`webidl.util.markAsUncloneable is not a function`): `jsdom@30` requires Node ≥ 22 | jsdom pinned to a Node-20-compatible major (65cbf40) |
| F2 | Low | Focus fell to `<body>` when Run benchmark, the last Next step or Reset disabled itself | Focus moved to the result heading (65cbf40) |
| F3 | Medium | Preview served an older build than the branch | Redeployed |
| F4 | Medium | First-run keyboard flow stuck at Audit: Next step disables while the sealed chunk loads | `canNext`/`canBack` focus effect in `App.tsx` (c1a40da) |
| F5 | Medium | Preview lagged `main` by PRs #5–#6 | Redeployed from `main` |
| F6 | Medium | Run log trace did not match what ran: a cached Audit claimed a new `unseal()` request and dropped the findings; the receipt rule read `baseline = Proceed` whatever the baseline was; unseal results had no trigger | Accurate cached-audit facts, per-clause rule, `Produced by` fact (0c5ef2a, #16) |
| F7 | Medium | After a failed evaluation load, the advice to Reset repeated the failure: browsers cache a rejected dynamic `import()` for the page's lifetime. Only a page reload recovers | Error card offers Reload page first; the `Now` line and Recovery step say reload (1d1d268, 21683ab, #17) |

## Known limits

- Accessibility was checked with Playwright accessibility snapshots, not a real screen reader.
- `@testing-library/jest-dom@7.0.1` prints an `EBADENGINE` warning (wants Node ≥ 22) on `npm install`; tests pass on Node 20.
- Back / Next step keep focus while stepping (Next step is held with `aria-disabled` while the sealed evaluation loads). Focus moves to the stage heading only when the focused control disables itself: Back at Evidence, Next step at Receipt.
- LAB-001 and the EI-001 default were checked on a local preview build only, not on a deployed preview.
- Receipt outcomes the fixtures can't produce (a non-Proceed baseline) and the #17 Reload page button are covered by unit tests only, not a browser run.
