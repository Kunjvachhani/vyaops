# Benchmark Findings — S8.3 (2026-06-28)

Full 1000-case run during S8.3 end-to-end testing.
Run file: `benchmark-results-2026-06-28T08-28-19-220Z.{jsonl,json}`.

## Headline — gate MET on scored cases; run invalidated by an OpenRouter billing limit

- **Raw: 749/1000 (74.9%)** → prints `✖ FAIL` because **92 cases errored** and the
  runner counts errors as fails.
- **87 of the 92 errors are `OpenRouter error 403: Key limit exceeded (total limit)`** —
  the Qwen eval-gate key hit its OpenRouter total limit ~87% through the run. Every case
  after that errored. **agri was the last industry block**, so 87/100 agri cases errored
  → the `agri 12%` headline is an artifact, not model quality (agri clean cases: **12/13**).
- The other ~5 errors are ZodErrors on multi-product messages (known residual, schema
  needs line-items — see memory `benchmark-supervised-run-plan`).
- **True pass rate over the 908 cleanly-scored cases: 749/908 = 82.4% — above the 80% gate.**

This repeats the v2 pattern (v2 hit an OpenRouter 402 mid-run and was `--resume`d).

### Resolution
Top up / raise the OpenRouter key's total limit, then:
```bash
npm run test:benchmark -- --resume    # re-runs only the 92 errored cases (~₹8)
```
`--resume` reuses the 908 cleanly-scored cases from the latest `.jsonl`.

## Dimensions (clean-scored cases only, n=908)

| Dimension | this run | v2 (full 1000) | note |
|---|---|---|---|
| eval score | 840/908 (92.5%) | 90.4% | up |
| intent | 830/908 (91.4%) | 90.5% | up |
| quantity | 379/439 (86.3%) | 85.3% | up |
| customer match | 503/729 (69.0%) | 69.7% | flat |
| **product match** | 339/576 (**58.9%**) | 49.7% | **+9** — fix #1 (commit `8a2dbdd`) landed |

Product match is the expected mover: the v2 doc's fix #1 (`applyDialectHints`
fill-not-clobber) was committed after v2 was measured and shows up here for the first time.

## Runner fixes made this session (S8.3) — the runner was BROKEN by S8.2

1. **`server-only` resolution.** S8.2 added `src/lib/ai/usage-logger.ts` (`import 'server-only'`),
   pulled in via the deepseek/openrouter AI chain. Under `tsx` (not the Next build) it
   resolved to the throwing `index.js` → runner crashed at module load. Fix: added
   `server-only` devDep + `--conditions=react-server` on the tsx test scripts (resolves to
   the no-op `empty.js`, the same condition Next uses for Server Components).
2. **`ai_usage` permission spam.** `logAiUsage` only skips when `NODE_ENV==='test'`; the
   runner didn't set it → "permission denied for table ai_usage" per case. Added
   `NODE_ENV=test` to the `test:benchmark` script.

Both baked into `package.json` → `npm run test:benchmark` is self-contained.

## Matcher decision — token-aware products REJECTED (safety)

The v2 doc's ranked fix #2 ("token-aware `matchProduct`") was implemented, then **reverted**:
`tokenAwareScore` takes the max over token-vs-token pairs, so product names sharing a
generic trailing category token false-match at **confidence 1.0** — observed
`"Gear Box Housing" → "Pump Housing" (1.0)` on the shared word "Housing". That would
auto-resolve to the **wrong product and create a wrong order** — worse than a miss.
`matchProduct` stays on conservative whole-string `scoreAgainst`. The product-match lever
should instead come from dialect Tier-3 aliases + the fill-not-clobber hint path, not a
permissive matcher.
