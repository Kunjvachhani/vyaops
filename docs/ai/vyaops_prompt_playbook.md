# VyaOps Prompt Playbook

Operational guide for the AI pipeline. Explains WHEN each prompt fires, HOW they chain together, and WHERE the dialect dictionary intervenes. For raw prompt text, see `PROMPT_LIBRARY.md`.

---

## Message Processing Flow

```
WhatsApp message arrives (webhook)
       │
       ▼
┌─ WEBHOOK AUTH (before any processing) ───────────────────┐
│ Two-layer verification per CLAUDE.md:                     │
│ Layer 1: X-Hub-Signature-256 HMAC                         │
│   → try DUALHOOK_SIGNING_SECRET, then META_APP_SECRET     │
│ Layer 2 (fallback): URL token (?t= param)                 │
│ REJECT if both fail. Acknowledge 200 in <1 second.        │
│ Processing is async (Next.js after()).                     │
└───────────────────────────────────────────────────────────┘
       │
       ▼
┌─ STEP 0: Echo Check ─────────────────────────────────────┐
│ Is wamid in whatsapp_messages outbound log?               │
│ YES → ignore (echo loop prevention, Rule C)               │
│ NO  → continue                                            │
└───────────────────────────────────────────────────────────┘
       │
       ▼
┌─ STEP 1: Org Lookup ─────────────────────────────────────┐
│ phone_number_id → organizations.whatsapp_phone_number_id  │
│ Load org tier, industry_segment, language_preference       │
└───────────────────────────────────────────────────────────┘
       │
       ▼
┌─ n8n HANDOFF ────────────────────────────────────────────┐
│ Webhook forwards to n8n master-message-handler:           │
│ {message, chatPhone, orgId, messageType, isCommand?}      │
│ n8n routes:                                               │
│   customer_text → /api/whatsapp/flow (Steps 2-5 below)   │
│   owner_echo    → /api/whatsapp/flow (Step 6 below)      │
│   status/unknown → log only, no reply                     │
│ n8n NEVER calls DeepSeek, Meta, or Supabase directly.     │
│ All AI + WhatsApp + DB flows through the Next.js layer.   │
└───────────────────────────────────────────────────────────┘
       │
       ▼
┌─ STEP 2: Dialect Dictionary (Layer 0) ───────────────────┐
│ Module: src/lib/ai/dialect-lookup.ts                      │
│ Input: raw message text + org_id + industry_segment       │
│ Lookup: Tier 4→3→5→2→1 (see DIALECT_DICTIONARY.md)       │
│ Output: DialectLookupResult                               │
│   - resolved_tokens: [{token, canonical, tier, category}] │
│   - pre_structured: {quantity?, customer_hint?, ...}      │
│   - unresolved_tokens: string[]                           │
│   - raw_message: original text                            │
└───────────────────────────────────────────────────────────┘
       │
       ▼
┌─ STEP 3: AI Classification ─────────────────────────────┐
│ IF resolved_tokens exist → Prompt #9 (Dialect-Aware)     │
│ IF no resolved tokens   → Prompt #1 (Standard)           │
│ Model: DeepSeek V4 Pro                                   │
│ Output: {intent, confidence, entities, language_detected} │
└───────────────────────────────────────────────────────────┘
       │
       ▼
┌─ STEP 4: Eval Gate ──────────────────────────────────────┐
│ Model: Qwen 3.7 Max (cross-model scoring)                │
│ Prompt: #8 (see EVAL_LOOP.md)                            │
│ Scores: accuracy, completeness, safety (0.00-1.00)       │
│ Decision bands:                                          │
│   auto_process (≥0.85) → post draft immediately          │
│   confirm (0.50-0.84)  → ask owner for clarification     │
│   reject (<0.50)        → show menu, don't guess          │
│ CRITICAL: auto_process = "skip clarification step"        │
│           NOT "skip owner ok". Draft+ok always required.  │
└───────────────────────────────────────────────────────────┘
       │
       ▼
┌─ STEP 5: Intent Routing ────────────────────────────────┐
│ NEW_ORDER      → create pending_order → draft to owner   │
│ MODIFY_ORDER   → Prompt #4 → draft modification          │
│ CANCEL_ORDER   → Prompt #5 → draft cancellation          │
│ ORDER_STATUS   → log only (Rule A: no auto-reply)        │
│ INVENTORY_CHECK→ log only                                │
│ GENERAL_QUERY  → log only                                │
│ INVOICE_REQUEST→ generate PDF → draft to owner           │
│ PAYMENT_UPDATE → log payment → draft to owner            │
│                                                           │
│ NOTE: Only ONE pending_order in (detected, draft_posted)  │
│ per org+customer. New detection expires the old one first. │
│ See MESSAGE_PIPELINE.md for the full state machine.        │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌─ STEP 6: Owner Response Loop ───────────────────────────┐
│ Owner sees draft in WhatsApp chat                        │
│ Owner replies → Prompt #3 (CONFIRMATION_PARSER)          │
│   confirmed=true  → create/modify/cancel order → send    │
│   cancel=true     → discard draft                        │
│   neither         → wait (or re-prompt after timeout)    │
│                                                          │
│ IF owner replied BEFORE draft posted:                    │
│   → Prompt #2 (OWNER_REPLY_CLASSIFIER)                   │
│   AFFIRM → post draft immediately                        │
│   DECLINE → discard pending_order                        │
│   UNRELATED → ignore, continue waiting                   │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌─ STEP 7: Dialect Learning (post-correction) ────────────┐
│ Module: src/lib/ai/dialect-learner.ts                     │
│ IF owner corrected draft entities:                        │
│   → Prompt #11 (Correction Analyzer)                     │
│   is_dialect_issue=true → upsert org_dictionary (Tier 4) │
│   likely_scope="industry" + 3 orgs confirmed             │
│       → promote to industry_dictionary (Tier 3)          │
│   3+ orgs any industry confirmed                         │
│       → promote to global_dictionary (Tier 5)            │
└──────────────────────────────────────────────────────────┘
```

---

## Prompt Selection Matrix

| Situation | Prompt # | Model | Notes |
|-----------|----------|-------|-------|
| New message, no dialect hits | #1 | DeepSeek | Standard classification |
| New message, dialect pre-resolved some tokens | #9 | DeepSeek | Validates dictionary + resolves remainder |
| Owner reply before draft posted | #2 | DeepSeek | AFFIRM/DECLINE/UNRELATED |
| Owner reply to visible draft | #3 | DeepSeek | Confirmed/date/cancel |
| Customer wants to modify order | #4 | DeepSeek | Add vs replace vs ambiguous |
| Customer wants to cancel order | #5 | DeepSeek | Match to open order |
| Daily summary | #6 | DeepSeek | WhatsApp-formatted digest |
| Invoice text | #7 | DeepSeek | Formal invoice content |
| Eval gate scoring | #8 | Qwen 3.7 Max | Cross-model validation |
| Onboarding alias generation | #10 | DeepSeek | Bulk dictionary seeding |
| Post-correction dialect analysis | #11 | DeepSeek | Learning loop trigger |

---

## Dialect Dictionary Integration Points

### Where it runs:
1. **Every inbound message** — Layer 0 runs before any AI call
2. **Onboarding** — Prompt #10 generates initial org_dictionary entries
3. **Post-correction** — Prompt #11 analyzes corrections for new mappings
4. **Fuzzy matching (Layer 4)** — org_dictionary entity_id links used alongside Levenshtein/Soundex

### What it resolves (zero AI cost):
- Gujarati/Gujlish numbers: "pachso" → 500, "sau" → 100
- Gujarati verbs: "moklo" → send, "joiye" → need
- Business terms: "udhaar" → credit, "bhav" → rate
- Industry jargon: "saancho" → mould (foundry), "thaan" → fabric bolt (textiles)
- Org-specific aliases: "VB" → Valve Body, "dharmu" → Dharmesh Patel

### What it does NOT resolve (deferred to AI):
- Ambiguous tokens in context (e.g., "sau" could be 100 or a name)
- Multi-word expressions not in dictionary
- Voice-to-text garbled input
- Novel slang not yet learned

---

## Safety Rules (Hardcoded, Non-Negotiable)

1. **Bot silence (Rule A):** Bot never initiates messages to customers. Only sends: order drafts after owner affirm, confirmations after owner "ok", and `/status` replies when owner types `/status`.

2. **Draft+ok always required (Rule B):** No state change (create/modify/cancel) without visible draft AND explicit owner "ok". `auto_process` skips clarification, never skips owner "ok".

3. **Echo prevention (Rule C):** Check wamid against outbound log. Also check text signatures. Without this, infinite loop.

4. **Informational queries logged only:** ORDER_STATUS, INVENTORY_CHECK, GENERAL_QUERY are NEVER auto-answered to customers. Logged for dashboard display.

5. **Eval gate failure → confirm band:** If eval gate errors or returns garbage, default to `confirm` (ask owner). Never auto-process on eval failure.

6. **Dialect override validation:** When Prompt #9 overrides a dictionary lookup, log the override for review. If the dictionary is wrong, it needs fixing — not silent AI overrides.

7. **Internal API auth:** All n8n → Next.js callback routes (`/api/whatsapp/flow`, `/api/ai`, `/api/whatsapp/send`, `/api/analytics/log-intent`, `/api/errors/log`) require `x-internal-api-key` header matching `INTERNAL_API_KEY`. n8n holds only `APP_URL` + `INTERNAL_API_KEY`, no Meta/DeepSeek keys.

---

## Model Router Logic

```
src/lib/ai/model-router.ts

Decision tree:
  task = "eval_gate"         → Qwen 3.7 Max (cross-model prevents self-bias)
  task = "complex_reasoning" → Qwen 3.7 Max (multi-step logic)
  else                       → DeepSeek V4 Pro (fast, cheap, good multilingual)

Fallback:
  DeepSeek down → route to Qwen 3.7 Max
  Qwen down     → route to DeepSeek
  Both down     → return error, log to Sentry, do NOT guess
```

---

## Cost Optimization

1. **Dialect dictionary resolves ~40-60% of tokens** in typical Gujlish messages before AI sees them. This directly reduces token count and ambiguity.

2. **Cache identical inputs** with 5-min TTL. Common patterns (greetings, repeat orders) hit cache.

3. **DeepSeek at $0.435/M tokens** handles 90% of calls. Qwen only fires for eval gate + complex reasoning.

4. **Batch processing:** Daily summaries (#6) and onboarding alias generation (#10) are batched, not per-message.

---

## Adding a New Prompt

1. Write the prompt with few-shot examples in `PROMPT_LIBRARY.md`
2. Add the selection criteria to the matrix above
3. Wire it through `model-router.ts` (pick DeepSeek unless cross-model validation needed)
4. Add eval gate coverage if the output drives a state change
5. Add benchmark cases in `tests/ai/benchmark.json`
6. If the prompt uses dialect-resolved tokens, accept `DialectLookupResult` as input
