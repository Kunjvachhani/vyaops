# Benchmark Findings v2 — 2026-06-20

Full 1000-case re-run after the 6 fixes + dialect Layer 0 integration.
Runner commit `552c8b0`; pipeline fixes `1297caa`, `e4c9924`.
(Run completed via `--resume` after an OpenRouter credit outage mid-run; 0 errored.)

## Headline

**798/1000 (79.8%)** — up from v1's **672 (67.2%)**: **+12.6 pts, +126 cases.**
A hair under the 80% gate. Cost ₹96 (~$1.16), 0 hard errors (v1 had 21).

> The fixes did exactly what the v1 findings predicted. Customer matching and
> Gujlish — the two biggest levers — moved hard. **Product match is now the sole
> thing keeping us under 80%, and fixing it projects to ~90%.**

## v1 → v2 by dimension

| Dimension | v1 | v2 | Δ |
|---|---|---|---|
| **customer match** | 33.3% | **69.7%** | **+36** |
| intent | 85.4% | 90.5% | +5 |
| quantity | 83.2% | 85.3% | +2 |
| eval score | 89.3% | 90.4% | +1 |
| **product match** | 55.4% | **49.7%** | **−6** ⚠️ |
| hard errors | 21 | **0** | fixed |

## v1 → v2 by language / industry

| Language | v1 | v2 | | Industry | v1 | v2 |
|---|---|---|---|---|---|---|
| English | 95% | 94% | | foundry | 69 | **86** |
| Hindi | 83% | 81% | | pharma | 72 | **86** |
| Hinglish | 74% | 82% | | food_processing | – | 81 |
| **Gujlish** | 57% | **76%** | | agri / auto_parts / textiles | 64/– /61 | **80/80/80** |
| | | | | ceramics / diamond | 68/62 | **78/78** |
| | | | | chemicals / plastics | 74/65 | 75/**74** |

Every industry improved or held. Gujlish +19 is the proof the dialect work landed.

## What the fixes validated

- **#1 token-aware customer matching** — the headline win (customer 33→70%), as projected.
- **#3/#4 dialect Layer 0** — now genuinely wired into the live pipeline (`routeAndProcess`).
  Gujlish +19, quantity +2. Caught a real bug doing it: the loader dropped **every
  number word** (`buildStaticMap` skipped non-string values) — #4 was dead before this.
- **#5 schema/maxTokens** — hard errors 21 → 0.
- **#6 intent prompt** — intent +5; the `GENERAL_QUERY↔NEW_ORDER` confusion shrank.

## The one regression — and why (read this before celebrating)

**Product match fell 6 pts.** Of 317 product fails:
- **165 — right entity, scored < 0.80.** `matchProduct` never got the token-aware /
  lower-threshold treatment that `matchCustomer` did in #1. Same bug class, untouched.
- **120 — wrong entity, and ~half are dialect OVER-resolution.** The generic slang
  `kapdu`→Cotton Fabric clobbers *qualified* products: `"viskos kapdu"`→should be
  Viscose Fabric, `"jakard kapdu"`→Jacquard Fabric, but the hint forces Cotton Fabric
  (confidence 1.0, so it looks "resolved"). `applyDialectHints` overrides the AI's
  product even when the AI had the more specific, correct answer.
- 32 — no product extracted.

## Ranked action items (path to ~90%)

| # | Fix | Where | Est. impact | Effort |
|---|-----|-------|-------------|--------|
| 1 | **Make `applyDialectHints` fill-not-override for products** — only use `product_hint` when the AI extracted no product (or its raw fails to match); never clobber a qualified extraction | `model-router.ts applyDialectHints` | undoes the −6 regression; recovers ~40 textiles cases | S |
| 2 | **Token-aware + 0.80 threshold for `matchProduct`** — apply the #1 treatment to products (165 right-entity-sub-threshold) | `fuzzy-match.ts matchProduct` | product 50→~70% | M |
| 3 | **Product aliases / abbreviations** — `bc`→Bearing Cap, `gbh`→Gear Box Housing, `vb`→Valve Body, `dp`→Dupatta | industry_dictionary (Tier 3) | recovers abbrev misses | M |
| 4 | **Multi-product line-items** — schema can't represent `"200 X aur 25 Y"` (single product/qty) | `types/ai.ts` + pipeline | the hardest residual cases | L |

**Recoverable now:** 103 failing cases have product as one of exactly 2 misses —
fixing product matching (#1+#2) flips them: **798 → ~901 (≈90%).**

## Re-baseline

- **Current: 79.8%.** Gate: 80%. (v1: 67.2%.)
- After product #1+#2: **~90%** projected. Re-run and watch **product match** + **textiles/diamond**.
- Note: run against **local** Supabase (has the Tier-3 dialect tables); remote still
  needs the dialect migrations pushed for Layer 0 to work in production.
