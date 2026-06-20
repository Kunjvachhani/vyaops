# Benchmark Supervised-Run Runbook

How to run the 1000-case AI benchmark **with Claude supervising live**, analyze
failures *while it runs*, and end with an actionable improvement note — without
burning Claude usage by reading the whole results file.

> Goal of the exercise: understand exactly where the pipeline that turns messy
> Gujlish/Hinglish WhatsApp messages into structured orders breaks, so we know
> which improvements turn "bad/unstructured messages" into reliable operations.

---

## What the runner does (recap)

For each of 1000 cases in `benchmark.json`:
1. **Classify + extract** via the model router (DeepSeek) — exact tokens captured.
2. **Fuzzy-match** customer/product in-memory against that case's industry catalog
   (mirrors `src/lib/utils/fuzzy-match.ts`).
3. **Eval-gate score** via Qwen (OpenRouter) — exact tokens captured.
4. **Grade** 5 criteria: intent, customer match (>0.80), product match (>0.80),
   quantity exact, eval score ≥ expected_min. A case passes if ≤1 applicable
   criterion fails.

Cost ≈ **$0.85–1.00 (₹70–85)**, wall-clock ≈ **40–60 min** at concurrency 6.
APIs used: DeepSeek + OpenRouter only — **the benchmark itself uses zero Claude.**

---

## Outputs

| File | When | Purpose |
|------|------|---------|
| Console summary | at end | headline scorecard (industry/difficulty/language/dimension) |
| `benchmark-results-<ts>.jsonl` | **live, one line per case** | supervise mid-run; tail/grep/jq |
| `benchmark-results-<ts>.json` | at end | full aggregated report (`summary` + `results[]`) |

Both result files are git-ignored. The `.jsonl` is what makes live analysis possible.

---

## Step 1 — Pre-flight (cheap)

```bash
# keys present?
grep -qE '^DEEPSEEK_API_KEY=.+' .env.local && grep -qE '^OPENROUTER_API_KEY=.+' .env.local && echo OK

# credits sane + format check: 6-case smoke (~1 min, ~₹0.5)
npm run test:benchmark -- --limit=6 --concurrency=3
```

If the smoke run prints a clean summary, you're good for the full run.

## Step 2 — Launch the full run in the background

Run it so Claude can poll the live log without blocking:

```bash
npm run test:benchmark > /tmp/benchmark.out 2>&1 &
```

The first lines of `/tmp/benchmark.out` print the exact `.jsonl` path. Capture it:

```bash
JSONL=$(ls -t tests/ai/benchmark-results-*.jsonl | head -1); echo "$JSONL"
```

## Step 3 — Supervise live (Claude-efficient)

**Do NOT read the whole `.jsonl` into Claude.** Pull small aggregates only. Re-run
these every ~10 min as the file grows:

```bash
# how far along + running pass rate
wc -l "$JSONL"
jq -s 'length as $n | (map(select(.passed))|length) as $p
       | "\($p)/\($n) passing (\(($p*100/$n)|floor)%)"' "$JSONL"

# failures so far, counted by industry  (cheap, high-signal)
jq -r 'select(.passed==false).industry' "$JSONL" | sort | uniq -c | sort -rn

# failures by which CRITERION is breaking (the root-cause axis)
jq -r 'select(.passed==false) | .criteria
       | to_entries[] | select(.value.applicable and (.value.passed|not)) | .key' "$JSONL" \
  | sort | uniq -c | sort -rn

# failures by language and by difficulty
jq -r 'select(.passed==false) | "\(.language)\t\(.difficulty)"' "$JSONL" | sort | uniq -c | sort -rn
```

Then have Claude analyze a **small, targeted sample** of the worst bucket — e.g.
10 failing diamond-industry cases — to read the actual expected-vs-actual:

```bash
# 10 sample failures from the worst industry (replace `diamond`)
jq -c 'select(.passed==false and .industry=="diamond")
       | {id, input, expected, actual, miss:[.criteria|to_entries[]|select(.value.applicable and (.value.passed|not))|.key]}' \
  "$JSONL" | head -10
```

Feed *that slice* (not the file) to Claude. This keeps each analysis turn small.

## Step 4 — Final summary

When `/tmp/benchmark.out` shows the SUMMARY block (or the process exits):

```bash
tail -40 /tmp/benchmark.out                       # console scorecard
JSON=$(ls -t tests/ai/benchmark-results-*.json | head -1)
jq '.summary' "$JSON"                              # machine summary (tiny)
```

---

## Analysis axes → likely fixes (hypotheses to confirm against real data)

| If failures cluster on… | Look at… | Likely lever |
|---|---|---|
| **intent** (wrong classification) | `CLASSIFY_SYSTEM_PROMPT` in `deepseek.ts` | intent keyword lists, few-shot examples per industry |
| **customer / product match** | `fuzzy-match.ts` thresholds + **dialect dictionary** | aliases/Tier-2 business vocab, phonetic bonus, 0.80 cutoff |
| **specific industry** (e.g. ceramics) | that industry's slang_terms vs `config/industries/*` | industry dictionary (Tier 3) coverage |
| **specific language** (gujlish/hinglish) | Layer-0 dialect lookup (`dialect-lookup.ts`) | Tier 1/2 dictionary entries, normalization |
| **quantity** | extraction prompt | unit/number parsing, ambiguous-quantity handling |
| **eval score low but extraction looks right** | `eval-gate.ts` weights/prompt | dimension weights, eval prompt calibration |

> Remember: the eval gate runs the **dialect dictionary at Layer 0** before the AI.
> A cluster of dialect/language failures is usually a *dictionary coverage* gap,
> not a model problem — and every such miss is a candidate new dictionary entry
> (the same loop `dialect-learner.ts` automates from production corrections).

## Step 5 — The deliverable note

End with `tests/ai/BENCHMARK_FINDINGS-<date>.md` containing:
1. **Headline:** overall pass rate vs 80% gate; pass/fail.
2. **Weakest buckets:** bottom 3 industries, languages, and the dominant failing
   criterion — with counts.
3. **Root-cause clusters:** grouped failure patterns (cite 2–3 example case IDs each).
4. **Ranked action items:** concrete fixes (prompt edit / dictionary entries /
   threshold change), each tagged with the bucket it should move and rough effort.
5. **Re-baseline:** the number to beat on the next run.
