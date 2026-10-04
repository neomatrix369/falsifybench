# FalsifyBench — design system

## Direction
**Engineering inspection report / instrument panel.** Precise, calm, data-first. The page should read like a release-review sheet an NDT engineer would sign, not a generic AI dashboard. Register: *Operate* — familiar controls, dense ruled tables, one committed shell colour, no decorative containers.

- **Shell**: a single graphite band (`--shell`) carrying the wordmark, section nav and the provenance mark; a sunken sub-bar carries the data/agent mode controls.
- **Sheets**: content sits on ruled paper sheets (`.sheet`) on a cool neutral ground. Inside a sheet, hierarchy comes from hairline rules, 2px ink rules for section heads, alignment and whitespace — not nested cards.
- **Signature moment**: the stage-4 outcome reading — `Baseline Proceed (unsafe) → Guarded Investigate · Score 15 → 95 (+80)` — set between two ink rules with large mono numerals, so the audit lands as a decision.
- **Second signature**: the bracket schematic is drawn on a drafting grid; the audited gap (R4) is hatched and sweeps in on reveal.

## Type
Self-hosted via `@fontsource` (no runtime network requests).

| Role | Face | Notes |
|---|---|---|
| UI / prose | Archivo Variable (wdth axis) | workhorse grotesque; headings and wordmark use a slightly expanded width (`.wide` 108%, `.wordmark` 118%) |
| IDs, readings, timestamps, scores | Red Hat Mono 400/500/600 | tabular numerals everywhere (`font-variant-numeric: tabular-nums` on `html`) |

Scale (Tailwind `fontSize` is replaced, so only these exist):

| Token | Size / line | Use |
|---|---|---|
| `meta` | 12 / 17.6 | labels, captions, status text |
| `body` | 14 / 22.4 | body copy, tables, controls |
| `lead` | 16 / 24.8 | claim paragraph, primary CTA, delta |
| `title` | 18 / 24 | section / scenario titles, totals |
| `display` | 26 / 32 | stage headline |
| `reading` | 40 / 40 | outcome numerals only |

## Colour tokens
Defined once as RGB triplets in `src/index.css` (`:root`) and exposed through `tailwind.config.js`, which **replaces** the default palette — components cannot reach `slate-*`, `indigo-*`, hex, etc.

| Token | Value | Role |
|---|---|---|
| `ground` | 236 237 233 | page ground |
| `surface` / `sunken` | 250 250 247 / 242 242 238 | sheet / recessed areas |
| `ink` / `ink-2` / `ink-3` | 22 25 28 / 62 68 74 / 92 99 106 | text tiers (16.9 / 9.4 / 5.8 : 1 on surface) |
| `rule` / `rule-strong` | 213 215 209 / 133 138 132 | hairlines / control borders (3.4:1) |
| `primary` (+`hover`, `tint`, `on`) | 36 71 154 | actions, current step, guarded path (white on primary 8.6:1) |
| `focus` | 59 111 224 | focus outline (4.4:1 on surface, 3.5:1 on shell) |
| `ok` (+`tint`, `line`) | 36 101 58 | completion only: completed steps, delta, "unsafe approval prevented" |
| `warn` (+`tint`, `line`) | 122 74 0 | uncertainty: audit findings, flagged step, Investigate, R4 gap |
| `risk` (+`tint`, `line`) | 158 42 32 | unsafe only: the unsafe baseline verdict |
| `shell` (+`ink`, `muted`, `line`) | 28 32 36 | header band |

Status is never colour alone: every state pairs colour with text and an icon/shape (verdict stamps, trace icons + "Completed / Flagged by audit / Current / Pending", hatch for the gap).

The generated score page (`public/score/index.html`, `npm run score`) takes the same tokens: `tools/score/style.ts` reads the `:root` block from `src/index.css` and the type scale, font stacks, radii and shadows from `tailwind.config.js` at generation time, and `tools/score/style.test.ts` fails on uppercase or tracked labels and raw hex.

## Spacing, radii, elevation
- 4px base rhythm; steps 4 / 8 / 12 / 16 / 20 / 24 / 32. Sheet padding 20–24px; page gutter 24px.
- Radii are replaced: `sm` 2px (tags, stamps), `DEFAULT` 3px (buttons), `md` 4px (sheets). No pills except the reading-point dot.
- Elevation: one `shadow-sheet` (1px + soft 8px at 6% ink) for sheets; nothing else floats. Hierarchy comes from rules first.

## Motion
- Colour transitions `duration-fast` (120ms) on interactive feedback; disclosure chevron `duration-base` (200ms); easing `ease-out` = `cubic-bezier(0.16, 1, 0.3, 1)`.
- One authored moment: R4 hatch sweeps in (`animate-reveal`, 520ms clip-path) when the audit reveals it; the default state is already visible.
- Auto-play keeps the existing 3 s state-machine interval.
- About page only: a 70 s linear ticker of the quoted figures (pauses on hover, focus or its Pause button); a falsification strip where a risk-red baseline dot is caught at the check node and an ok-green guarded dot runs through (7 s loop, flat, no glow); sheets rise in on scroll via `animation-timeline: view()` where supported. All three stop under reduced motion, leaving a static strip and a horizontally scrollable ticker.
- `prefers-reduced-motion: reduce` collapses all animation/transition durations and disables smooth scroll.

## Agent tells avoided
- No purple/indigo gradients, glow, glassmorphism/backdrop blur, emoji, or icon-in-a-tile logo.
- No uppercase tracked "eyebrow" labels; section names are real headings at body/title size.
- No stack of identical rounded white cards: the left column is three ruled sheets with distinct structures; the result surface is one sheet with ruled sections.
- No pill overload: provenance and fixture labels are quiet text with an icon; tags are squared and reserved for IDs and verdict stamps.
- No side-stripe accent borders on rounded cards, no gradient text, no hero-metric template — the one large number is the decision reading.
- Raw receipt JSON stays inside its disclosure; hidden audit strings never render before the Audit stage.
- Rejected tool suggestion: ui-ux-pro-max proposed "AI purple + generation pink" with Google-hosted Fira — rejected for the playbook's neutral ground, red/amber/green semantics, and self-hosted fonts.
