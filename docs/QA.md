# QA / release review

Read-only acceptance review of FalsifyBench against the playbook's **Acceptance checklist**, **Product truthfulness rules**, **Guided walkthrough** and **Data and code contracts** (`docs/falsifybench-playbook.md`).

- **Revision:** `main` @ `30183f9` (PRs #1–#6)
- **Targets:** deployed preview <https://dist-goqefkae.devinapps.com> and a local `npm run preview` of the same revision. Every deployed asset (`index-8JJ1Kb_j.js`, CSS, both evaluation chunks, `index.html`, `frs/index.html`) is byte-identical to a local build.
- **Runtime:** Node 20.20.2. Browser checks drove Chrome over CDP with `playwright-core` (DOM, accessibility snapshot, page source, focus, clipboard, downloads, request log, emulated `prefers-reduced-motion`).
- **Result:** all items pass on both targets; no open failures.

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

## Failures found and fixed during review

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| F1 | Medium | `npm test` crashed on Node 20 (`webidl.util.markAsUncloneable is not a function`): `jsdom@30` requires Node ≥ 22 | jsdom pinned to a Node-20-compatible major (65cbf40) |
| F2 | Low | Focus fell to `<body>` when Run benchmark, the last Next step or Reset disabled itself | Focus moved to the result heading (65cbf40) |
| F3 | Medium | Preview served an older build than the branch | Redeployed |
| F4 | Medium | First-run keyboard flow stuck at Audit: Next step disables while the sealed chunk loads | `canNext`/`canBack` focus effect in `App.tsx` (c1a40da) |
| F5 | Medium | Preview lagged `main` by PRs #5–#6 | Redeployed from `main` |

## Known limits

- Accessibility was checked with Playwright accessibility snapshots, not a real screen reader.
- `@testing-library/jest-dom@7.0.1` prints an `EBADENGINE` warning (wants Node ≥ 22) on `npm install`; tests pass on Node 20.
- After focus moves to a result heading (Audit, Receipt), Enter does nothing until the user tabs back to Next step; this is consistent across stages.
