# Benchmark Findings — 2026-06-20

Full 1000-case run of `npm run test:benchmark` (commit `30a6d5b`).
Results file: `tests/ai/benchmark-results-2026-06-20T07-02-28*.json` (git-ignored).

## Headline

**672/1000 passed (67.2%) — below the 80% gate (exit 1).**
Cost ₹84.62 (~$1.02), 2.45M tokens, 54.8 min wall-clock, 21 hard errors.

> The core pipeline is sound — it's the **dialect layer** that's underpopulated.
> Clean input works great; the messy Gujlish our actual users type is where it breaks.
> **One fix (customer matching) recovers ~189 cases and clears the gate on its own.**

## Scorecard

| By language | pass | | By difficulty | pass |
|---|---|---|---|---|
| English | **95.3%** | | easy | **97.0%** |
| Hindi | 83.0% | | hard | 77.0% |
| Hinglish | 74.2% | | edge | 76.0% |
| **Gujlish** | **57.4%** | | medium | 53.5% |
| | | | **gujlish** | **49.6%** |

| By dimension | pass | | Weakest industries | pass |
|---|---|---|---|---|
| eval score | 89.3% | | textiles | 61% |
| intent | 85.4% | | diamond | 62% |
| quantity | 83.2% | | auto_parts | 64% |
| product match | 55.4% | | plastics | 65% |
| **customer match** | **33.3%** | | (best: chemicals 74%) | |

## What already works (don't touch)

- **English 95%, easy 97%** — classification + extraction + eval are fundamentally correct.
- **intent 85%, eval score 89%, quantity 83%** — solid on clean/numeric input.
- The eval gate and safety routing are behaving; failures are upstream (extraction/matching), not the gate.

## Root-cause clusters (ranked by recoverable impact)

### #1 — Customer matching: full-name master data vs first-name/nickname/honorific refs  ⭐ TOP LEVER
- **534 customer-match fails; 479 (90%) are the *correct* customer, just scored < 0.80.** Only 22 are genuinely wrong.
- Mechanism: customers are addressed as `vijay`, `dharmu`, `patel saheb`, `suresh bhai` — but master data stores `Vijay Mehta`, `Dharmesh Shah`, `Rajesh Patel`. Whole-string Levenshtein punishes the missing surname (307 score even < 0.60).
- Examples: `vijay→Vijay Mehta @0.46`, `dharmu→Dharmesh Shah @0.54`, `patel saheb→Rajesh Patel @0.42`, `suresh bhai→Suresh Solanki @0.79`.
- **Production impact (not just test):** `matchCustomer` only auto-matches ≥ 0.85, so in production these become "clarify" prompts — the owner gets asked to confirm the customer on nearly every normal first-name order. Real UX tax.
- **Recoverable: ~189 cases flip to pass** (the 2-fail cases where customer is one of the two).

### #2 — Product slang vocabulary gap
- 94 product fails are *wrong* matches: the raw extracted word is dialect slang that doesn't lexically resemble any catalog product.
- Examples: `chunni`/`odhni → Dupatta`, `kapdu → Cotton Fabric`, `thraed → Embroidery Thread`, `maal`/`goods → (generic, no product)`.
- The matcher receives `"chunni"` and the catalog has `"Dupatta"` — no fuzzy score can bridge that. Needs a **slang→canonical** mapping.

### #3 — Gujarati/Hindi spelled-out number words
- ~80 quantity fails are spelled-out numbers the model mis-parses.
- Examples: `saath` = 60 (parsed as 6), `enshi` = 80 (→11), `chha so` = 600 (→500), `nav so` = 900 (→null).
- Needs number-word normalization (Tier 1 universal Gujarati) before/at extraction.

### #4 — Intent confusion on edge/ambiguous messages
- 146 intent fails, dominated by `GENERAL_QUERY ↔ NEW_ORDER` (24 + 20 bidirectional) and `GENERAL_QUERY → PRODUCTION_UPDATE` (16).
- Mostly hard/edge dialect cases where intent is genuinely ambiguous. Lower priority than #1–3.

### #5 — Schema / output robustness (the 21 hard errors)
- **`price_raw`/`quantity` returned as a string → `DeepSeekClassifyResponseSchema` throws and discards the whole extraction.** Trigger: `"X no bhav fix karo <product> mate"` (price-negotiation phrasing). 3+ cases.
- **Multi-item messages produce malformed/truncated JSON** (`"Roof Tile 50 ane Vitrified Tile 100"`, `"terminated"` = request timeout). maxTokens 512 truncation and/or multi-product confusion.

## Unifying insight

Clusters **#1, #2, #3 — the bulk of the failures — are all dialect-dictionary (Layer 0) coverage gaps.**
The 5-tier dictionary system exists (`dialect-lookup.ts`) but is underpopulated for names, product slang, and number words. Every failing case here is a candidate dictionary entry — exactly what `dialect-learner.ts` is built to auto-promote from production corrections. The architecture is right; it needs seeding.

## Ranked action items

| # | Fix | Where | Est. impact | Effort |
|---|-----|-------|-------------|--------|
| 1 | **Token-aware matching** — score raw against each name token (first/last) and take max; **strip honorifics** (`bhai`, `saheb`, `ji`, `bhai`) before scoring | `src/lib/utils/fuzzy-match.ts` | customer 33%→~80%; **~189 cases → ~86% overall** | M |
| 2 | **Seed customer aliases** (first names, nicknames: `dharmu`→Dharmesh) so exact-alias fast-path hits 1.0 | onboarding dict / `org_dictionary` | compounds #1; kills "clarify" UX tax | M |
| 3 | **Industry product-slang dictionary** (chunni/odhni→Dupatta, kapdu→Cotton Fabric, maal→generic) | `industry_dictionary` (Tier 3) / `config/industries/*` | product 55%→~75% | M |
| 4 | **Gujarati number-word normalization** (saath=60, enshi=80, chha so=600, nav so=900) | dialect Tier 1 + `CLASSIFY_SYSTEM_PROMPT` examples | quantity 83%→~92% | S |
| 5 | **Schema robustness:** `.catch(null)` on `quantity`/`price_raw` numeric fields; raise classify `maxTokens` (512→~800) for multi-item | `src/types/ai.ts`, `deepseek.ts` | eliminates 21 hard errors | S |
| 6 | **Intent few-shots** for GENERAL_QUERY vs NEW_ORDER edge cases | `CLASSIFY_SYSTEM_PROMPT` | intent 85%→~90% | S |

**Recommended order:** #5 (quick, stops crashes) → #1 (biggest single lever, clears the gate) → #4 (quick win) → #3 → #2 → #6.

## Re-baseline

- **Current: 67.2%.** Gate: 80%.
- After #1 alone: ~86% (projected). After #1+#3+#4+#5: target **>90%**.
- Re-run `npm run test:benchmark` after each fix; watch the **customer match** and **Gujlish** numbers specifically — those are the needles to move.
