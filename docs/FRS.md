# FalsifyBench Release Score (FRS)

FRS is a single number in [0, 1] that answers one question for this repository: *is the current revision safe to merge and deploy?* It combines repository-wide quality, end-to-end correctness, synthetic-data alignment with the playbook, and bundle performance, behind hard gates that protect the product claim.

The latest snapshot is published with the app at `frs/index.html` (live: <https://dist-goqefkae.devinapps.com/frs/index.html>).

## Formula

```
FRS = G · H

H = 1 / ( 0.20/Q + 0.35/C + 0.30/S + 0.15/P )      weighted harmonic mean, Σw = 1
G = lint ∧ typecheck ∧ build ∧ no-bundle-leak ∧ no-DOM-leak-before-Audit ∧ no-network/secrets   ∈ {0, 1}

Q = (coverage_lines + coverage_branches + token_conformance) / 3
C = 2·u·a / (u + a)     u = unit tests passed / total;  a = playbook browser checks passed / 47
S = s · d               s = fixture-vs-playbook checks passed / total;  d = 1 if manual ≡ auto-play receipt, else 0.5
P = 0.7 · min(1, 80 kB / initial_gzip) + 0.3 · [sealed evaluation in a lazy chunk]
```

- **Harmonic, not linear.** Like F1, one weak dimension cannot be offset by strong ones (65cbf40: linear 0.919, harmonic 0.886 because Q = 0.61). Any sub-score of 0 makes H = 0.
- **Weights.** Correctness (0.35) and synthetic alignment (0.30) carry the product claim; quality 0.20; performance 0.15 (static PoC).
- **Gates.** Leaking the sealed MAT-001 evaluation before Audit, a failed build, or any network call/secret makes FRS = 0 regardless of the rest.

## Decision bands (policy)

| Condition | Decision |
|---|---|
| G = 0 or FRS < 0.85 | **Block**: do not merge or deploy |
| 0.85 ≤ FRS < 0.95, or a < 1 | **Ship with fix-forward**: merge only with a linked issue |
| FRS ≥ 0.95 and a = 1 | **Ship** |

## Signals

| Signal | Source |
|---|---|
| lint / typecheck / build | `npm run lint`, `npm run typecheck`, `npm run build` |
| u, coverage | `vitest run --coverage` (v8, `src/**`) |
| token conformance | share of `src/**/*.tsx` free of raw Tailwind palette classes and hex colours (see `DESIGN.md`) |
| bundle leak, lazy chunk, initial gzip | scan of `dist/assets` for the sealed evaluation terms |
| s | `tools/frs/alignment.check.ts`: MAT-001 fixture, scorecard, sealed evaluation, receipt and source wiring vs `docs/falsifybench-playbook.md` |
| a, d, DOM leak | `tools/frs/acceptance.py`: 47 playbook checks in real Chrome over CDP, including keyboard-only operation and manual ≡ auto-play |

## Running it

Requires Node 20, Python 3 with `playwright`, and a Chrome DevTools endpoint (`FRS_CDP`, default `http://localhost:29229`).

```bash
npm run frs                                        # score HEAD → .frs/results/HEAD.json
python3 tools/frs/frs.py <ref> --label <name>      # score any commit in a throwaway worktree
python3 tools/frs/frs.py main --mutate eager-leak  # deliberate break: must Block
python3 tools/frs/report.py                        # regenerate public/frs/index.html from .frs/results
```

`report.py` expects the five labels shown on the published page; update `NAMES` in it to change which revisions are compared.

## Known limits

- Not enforced: the repository has no CI, so FRS runs only when someone runs it.
- Browser half of C is essential: jsdom missed the keyboard focus loss present from 0975cca to 2219a0f.
- S covers MAT-001 only; agent claim wording is paraphrased from the playbook and not scored.
- P is at its ceiling (≈67 kB of 80 kB); self-hosted fonts are outside the budget.
- The published page references the hashed font files of the current build; if font packages change, it falls back to system fonts until regenerated.
