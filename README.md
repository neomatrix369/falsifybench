# FalsifyBench

A synthetic-first, explainable benchmark for AI research teams that need to decide whether an AI agent is safe to release into a scientific or engineering workflow.

> FalsifyBench exposes when a confident scientific or engineering agent lacks sufficient evidence, then shows whether a guarded evaluation path produces a safer, falsifiable next action.

The proof of concept walks through a single decision, end to end:

`evidence → baseline agent decision → falsification check → guarded verdict → benchmark receipt`

Its first scenario, **MAT-001 — Turbine Support Bracket Release Decision**, is a deterministic, hand-audited synthetic fixture. No real model, partner, sponsor, or validated study is involved, and no inference runs anywhere in this PoC.

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest (unit + DOM tests)
npm run lint
npm run typecheck
npm run build      # outputs static site to dist/
npm run preview    # serve dist/ locally
```

Mock mode needs no secrets and no network access.

## Release score

`npm run frs` computes the FalsifyBench Release Score (FRS): a gated, weighted harmonic mean of quality, correctness, synthetic-data alignment and performance that drives the merge/deploy decision. Definition and usage: [`docs/FRS.md`](docs/FRS.md). The latest snapshot ships with the site at `frs/index.html`.

## Code map

| Concern | Location |
|---|---|
| Branding (name isolated for renaming) | `src/config/branding.ts` |
| Domain types and `ScenarioSource` / `PartnerScenarioValidator` seams | `src/domain/types.ts` |
| Five-stage walkthrough state machine (manual and auto-play share the same transitions) | `src/domain/walkthrough.ts`, `src/domain/stages.ts` |
| Scoring helper (`total = round(mean(...))`, delta) | `src/domain/scoring.ts` |
| Provenance labels and partner-validation stub | `src/domain/provenance.ts` |
| Receipt creation (injected clock and run ID; refuses incomplete runs) | `src/domain/receipt.ts` |
| MAT-001 public fixture | `src/data/mat001.ts` |
| MAT-001 hidden evaluation truth (separate lazily loaded chunk, unsealed only at Audit) | `src/data/mat001.evaluation.ts` |
| Synthetic scenario source | `src/data/scenarioSource.ts` |
| React hook wiring the reducer, auto-play timer, and audit unsealing | `src/hooks/useWalkthrough.ts` |
| UI | `src/components/*`, `src/App.tsx` |

## Deferred seams (not in this PoC)

- Live agent calls. Any future integration must run server-side and read its keys from environment variables. Mock mode must never require a secret.
- A partner-data adapter. Validation is a pure stub, and partner benchmarks are never runnable until a validated source exists.
- Editable evidence, persistence, and the full research-validity and evidence-integrity walkthroughs.
