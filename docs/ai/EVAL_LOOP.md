# Eval Loop — Anti-Slop System

## Architecture
```
1. GENERATE (DeepSeek V4 Pro) → raw intent + entities JSON
2. SCORE (Qwen 3.7 Max via OpenRouter) → composite score 0.00-1.00
3. GATE (threshold routing):
   ≥ 0.85 → auto-process: post draft immediately (skip clarification step, NOT skip owner ok)
   0.70-0.84 → hold in temp cache, send clarification options to owner
   0.50-0.69 → show clarification options: "Did you mean [A] or [B]?"
   < 0.50 → silent fail, show guided prompt menu, log for benchmark
4. SHIP or REWORK → execute or re-capture via guided flow
5. MONITOR → track corrections, rejections, manual overrides
6. BENCHMARK GROWS → every correction = new test case
```

> **CRITICAL:** `auto_process` means "post the draft without asking for clarification." It NEVER means "skip the owner's ok and create an order directly." The draft + explicit owner "ok" loop is always required. See CLAUDE.md AI Integration Rules.

## Two-Model Pattern
Generator and evaluator are DIFFERENT models. Same-model eval shares blind spots.
- Generator: DeepSeek V4 Pro ($0.435/M tokens) — fast, cheap, good multilingual
- Evaluator: Qwen 3.7 Max ($1.20/$3.75 per M tokens via OpenRouter) — different architecture catches different errors

## Eval Prompt Structure
```
You are evaluating an AI extraction from a manufacturing WhatsApp message.

Original message: {raw_message}
AI extraction: {ai_output_json}
Available customers: {customer_list}
Available products: {product_list}

Score 0.00-1.00 on:
- intent_correctness (0-1): Is the classified intent correct?
- entity_completeness (0-1): Are all required fields extracted?
- entity_accuracy (0-1): Do extracted values match the message?
- match_confidence (0-1): Are fuzzy matches plausible?

Return JSON: { composite_score, intent_correctness, entity_completeness, entity_accuracy, match_confidence, reasoning, failure_codes[] }
```

## Benchmark File: tests/ai/benchmark.json
Start with 50 manual test cases. Grows from production corrections.
Run benchmark weekly: `npm run test:benchmark` → assert pass rate > 85%.
