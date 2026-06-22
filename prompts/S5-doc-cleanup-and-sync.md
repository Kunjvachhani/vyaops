# S5: Doc Cleanup & Sync — Make Every Doc Match Reality

CLAUDE.md is the source of truth. Every other doc must agree with it and with the actual codebase. This prompt fixes all known inconsistencies found during the staleness audit.

Do these in order. After all fixes, do a final verification pass.

---

## Fix 0 (CRITICAL): `docs/ai/vyaops_prompt_playbook.md` ↔ `CLAUDE.md` sync

The playbook is the operational guide for the entire AI pipeline — every prompt, every routing decision, every safety rule. It MUST match CLAUDE.md exactly. Here are the mismatches:

### 0a: Eval gate scale — playbook uses 0-10, CLAUDE.md implies 0.00-1.00

**Playbook lines 49-53:**
```
│ Scores: accuracy, completeness, safety (0-10)            │
│ Decision bands:                                          │
│   auto_process (≥8.0) → post draft immediately           │
│   confirm (5.0-7.9)   → ask owner for clarification      │
│   reject (<5.0)        → show menu, don't guess           │
```

**CLAUDE.md line 179:** `Eval gate auto_process means "post the draft immediately without asking for clarification"` — doesn't specify a scale, but references `docs/ai/EVAL_LOOP.md` which uses 0.00-1.00.

**Fix:** The eval prompt in EVAL_LOOP.md (lines 30-37) explicitly asks the model to `Score 0.00-1.00`. That's what the model actually produces. The playbook's 0-10 is wrong.

Replace playbook lines 49-53 with:
```
│ Scores: accuracy, completeness, safety (0.00-1.00)       │
│ Decision bands:                                          │
│   auto_process (≥0.85) → post draft immediately          │
│   confirm (0.50-0.84)  → ask owner for clarification     │
│   reject (<0.50)        → show menu, don't guess          │
```

### 0b: Playbook doesn't mention two-layer webhook auth

**Playbook line 10-17 (STEP 0: Echo Check):** Jumps straight from "WhatsApp message arrives (webhook)" to echo check. Doesn't mention webhook authentication at all.

**CLAUDE.md line 190:** Explicitly requires two-layer auth before any processing.

**Fix:** Add a new step BEFORE Step 0 in the playbook flow:

```
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
```

### 0c: Playbook missing n8n orchestration boundary

**CLAUDE.md line 193:** Explicitly states orchestration lives in n8n, proxied through Next.js. The webhook verifies + forwards to n8n; n8n routes and calls BACK into `/api/whatsapp/flow`.

**Playbook:** The flow diagram (Steps 0-7) describes the logic as a linear pipeline with no mention of n8n being the orchestrator. Someone reading only the playbook would think the webhook handler does everything directly.

**Fix:** Add a note between Step 1 (Org Lookup) and Step 2 (Dialect Dictionary) showing the n8n handoff:

```
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
```

### 0d: Playbook missing internal API auth requirement

**CLAUDE.md line 194:** Internal callback routes (`/api/whatsapp/flow`, `/api/ai`, `/api/whatsapp/send`, etc.) authenticate `x-internal-api-key` against `INTERNAL_API_KEY`.

**Playbook:** Never mentions this. The n8n callback auth requirement should be documented somewhere in the playbook since it affects how the pipeline actually works.

**Fix:** Add to the Safety Rules section (after rule 6, line 154):

```
7. **Internal API auth:** All n8n → Next.js callback routes (`/api/whatsapp/flow`, `/api/ai`, `/api/whatsapp/send`, `/api/analytics/log-intent`, `/api/errors/log`) require `x-internal-api-key` header matching `INTERNAL_API_KEY`. n8n holds only `APP_URL` + `INTERNAL_API_KEY`, no Meta/DeepSeek keys.
```

### 0e: Playbook missing `pending_orders` state machine details

**CLAUDE.md line 164:** Documents the partial unique index constraint — only ONE pending_order in (`detected`, `draft_posted`) per (organization_id, customer_phone). New detection supersedes old (old → `expired`).

**Playbook Step 5 (Intent Routing) line 60:** Says `NEW_ORDER → create pending_order → draft to owner` but doesn't mention the uniqueness constraint or supersession logic.

**Fix:** Add a note under the Intent Routing box:

```
│ NOTE: Only ONE pending_order in (detected, draft_posted)  │
│ per org+customer. New detection expires the old one first. │
│ See MESSAGE_PIPELINE.md for the full state machine.        │
```

### 0f: Playbook Prompt Selection Matrix — verify all prompt numbers match PROMPT_LIBRARY.md

**Fix:** Open `docs/ai/PROMPT_LIBRARY.md` and verify every prompt number (#1 through #11) in the playbook's matrix (lines 102-114) matches the actual prompt numbering in the library. If any prompt was added, removed, or renumbered since the playbook was written, update the matrix.

---

## Fix 1 (HIGH): `docs/ai/EVAL_LOOP.md` — auto_process wording is dangerous

**File:** `docs/ai/EVAL_LOOP.md`
**Line 8:** Currently says:
```
≥ 0.85 → auto-process, create record, send confirmation
```

This reads like auto_process means "skip the owner's ok and create an order directly" — which CLAUDE.md explicitly forbids. The playbook (`docs/ai/vyaops_prompt_playbook.md` lines 50-55) has the correct definition.

**Fix:** Replace the gate section (lines 7-11) with:
```
   ≥ 0.85 → auto-process: post draft immediately (skip clarification step, NOT skip owner ok)
   0.70-0.84 → hold in temp cache, send clarification options to owner
   0.50-0.69 → show clarification options: "Did you mean [A] or [B]?"
   < 0.50 → silent fail, show guided prompt menu, log for benchmark
```

Also add a bold warning note right after the gate section:
```
> **CRITICAL:** `auto_process` means "post the draft without asking for clarification." It NEVER means "skip the owner's ok and create an order directly." The draft + explicit owner "ok" loop is always required. See CLAUDE.md AI Integration Rules.
```

### Scale reconciliation

`EVAL_LOOP.md` uses a 0.00-1.00 scale. `vyaops_prompt_playbook.md` uses a 0-10 scale. Pick ONE canonical scale and make both files match.

**Decision:** Keep 0.00-1.00 (it's what the eval prompt on line 30-37 of EVAL_LOOP.md actually asks the model to produce). Update `vyaops_prompt_playbook.md` lines 50-53 to use 0.00-1.00:
```
   auto_process (≥0.85) → post draft immediately
   confirm (0.50-0.84)  → ask owner for clarification
   reject (<0.50)       → show menu, don't guess
```

---

## Fix 2 (HIGH): `docs/security/RLS_POLICIES.md` — org_dictionary uses raw user_metadata

**File:** `docs/security/RLS_POLICIES.md`
**Lines 76-81:** The `org_dictionary` policies hardcode `(auth.jwt()->'user_metadata'->>'org_id')::uuid` instead of using the `_current_org_id()` helper function defined at the top of the same doc (lines 29-36).

Every other table in the doc correctly uses `_current_org_id()`. This is a copy-paste oversight.

**Fix:** Replace lines 74-82 with:
```sql
ALTER TABLE org_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select" ON org_dictionary FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);
CREATE POLICY "insert" ON org_dictionary FOR INSERT
  WITH CHECK (organization_id = _current_org_id());
CREATE POLICY "update" ON org_dictionary FOR UPDATE
  USING (organization_id = _current_org_id());
```

**Also:** If a live migration has already been applied with the raw `user_metadata` path, write a new migration to DROP and recreate these three policies using `_current_org_id()`. Check `supabase/migrations/` for any migration that created `org_dictionary` RLS policies and determine if a fix migration is needed.

---

## Fix 3 (HIGH): `docs/BUILD_GUIDE.md` — three contradictions with CLAUDE.md

**File:** `docs/BUILD_GUIDE.md`

### Fix 3a: Line 134 — wrong auth metadata location
**Currently:** `Use Supabase Auth. Store org_id and role in user_metadata.`
**Fix:** Replace with:
```
Use Supabase Auth. Store org_id and role in app_metadata (NOT user_metadata — user_metadata is self-editable by the user, see CLAUDE.md Security Rule 12). Use adminClient.auth.admin.updateUserById() to stamp app_metadata server-side.
```

### Fix 3b: Lines 208-211 — wrong webhook auth + wrong org lookup
**Currently (line 208):**
```
- Verify Meta webhook signature using X-Hub-Signature-256 header against META_WHATSAPP_APP_SECRET (HMAC-SHA256)
```
**Fix:** Replace with:
```
- Verify webhook signature — two-layer auth per CLAUDE.md:
  Layer 1: X-Hub-Signature-256 HMAC against DUALHOOK_SIGNING_SECRET then META_WHATSAPP_APP_SECRET
  Layer 2 (fallback): secret URL token (?t= query param, WHATSAPP_WEBHOOK_URL_TOKEN)
  Layer 2 exists because Dualhook Coexistence deliveries are signed with Dualhook's tech-provider app secret, which is not exposed to us.
```

**Currently (line 211):**
```
- Lookup organization by sender phone number from organizations table
```
**Fix:** Replace with:
```
- Lookup organization by metadata.phone_number_id → organizations.whatsapp_phone_number_id (NEVER by sender phone — sender is the customer)
```

### Fix 3c: Lines 213-214 — references deprecated opt-in-trigger model
**Currently:**
```
- Check if message is triggered (button tap, /prefix, reply to bot)
- If not triggered: classify silently, log, do NOT respond
- If triggered: queue for AI processing
```
**Fix:** Replace with:
```
- Determine message type: customer inbound (field: "messages") or owner echo (field: "smb_message_echoes" / "message_echoes")
- Customer inbound: classify via AI, create pending_order if NEW_ORDER, bot stays silent
- Owner echo: run echo loop guard (wamid check), then route to flow engine for affirmation/confirmation
- See docs/architecture/MESSAGE_PIPELINE.md for the full flow
```

---

## Fix 4 (HIGH): `docs/infrastructure/DEPLOYMENT.md` — single-layer webhook auth

**File:** `docs/infrastructure/DEPLOYMENT.md`
**Lines 64-67:** Only describes single-layer HMAC auth. Missing the two-layer model.

**Fix:** Replace the "Webhook Security" section (lines 63-68) with:
```
## Webhook Security
- WhatsApp (two-layer auth per CLAUDE.md):
  - Layer 1: X-Hub-Signature-256 HMAC — first try DUALHOOK_SIGNING_SECRET, then META_WHATSAPP_APP_SECRET
  - Layer 2 (fallback): secret URL token (?t= query param, WHATSAPP_WEBHOOK_URL_TOKEN) baked into the Dualhook webhook URL. Required because Dualhook Coexistence deliveries are signed by their tech-provider app secret.
- Razorpay: verify X-Razorpay-Signature with RAZORPAY_WEBHOOK_SECRET
- REJECT any webhook that fails ALL applicable verification layers
- Log all rejected webhooks to Sentry for monitoring
```

---

## Fix 5 (HIGH): `docs/architecture/MESSAGE_PIPELINE.md` — orchestration boundary webhook auth

**File:** `docs/architecture/MESSAGE_PIPELINE.md`
**Line 186:** Says `HMAC-SHA256 verification using META_WHATSAPP_APP_SECRET` — only describes one layer.

**Fix:** Replace line 186 with:
```
- Two-layer webhook auth: HMAC-SHA256 (DUALHOOK_SIGNING_SECRET → META_WHATSAPP_APP_SECRET fallback) + URL token fallback (WHATSAPP_WEBHOOK_URL_TOKEN)
```

---

## Fix 6 (MEDIUM): `docs/infrastructure/N8N_PIPELINE.md` — lists unbuilt workflows as if they exist

**File:** `docs/infrastructure/N8N_PIPELINE.md`

**Reality:** Only 3 workflow files exist in `n8n/workflows/`:
- `master-message-handler.json` ✅
- `daily-order-summary.json` ✅
- `payment-reminder.json` ✅

The "Message-Triggered" table (lines 29-35) lists `order-intake`, `invoice-generator`, `production-logger`, `inventory-checker` as separate workflows. These don't exist as files — their logic is handled inside `master-message-handler` + Next.js API routes.

The "Scheduled" table lists `daily-evening-summary`, `low-stock-alert`, `compliance-reminder` — these don't exist yet.

The "Event-Triggered" table lists `order-completed`, `payment-received`, `inventory-low` — these don't exist yet.

**Fix:** Add a status column to each table:

```markdown
### Message-Triggered (real-time, <15s processing)
| Workflow | Trigger | Action | Status |
|----------|---------|--------|--------|
| master-message-handler | Meta Cloud API webhook (via Dualhook) | Routes to flow engine based on message type | ✅ Built |
| order-intake | Intent=NEW_ORDER | Parse → match → eval → draft → confirm → create | ⚠️ Handled inside master-handler + /api/whatsapp/flow, not a separate workflow |
| invoice-generator | Intent=INVOICE_REQUEST or order completed | Generate PDF → save → send | 🔲 Planned |
| production-logger | Intent=PRODUCTION_UPDATE | Parse → validate → save → update | 🔲 Planned |
| inventory-checker | Intent=INVENTORY_CHECK | Query stock → format → respond | 🔲 Planned |

### Scheduled (cron-based)
| Workflow | Schedule | Action | Status |
|----------|----------|--------|--------|
| daily-order-summary | 8:00 AM IST | Yesterday orders + today production + overdue → send template | ✅ Built |
| payment-reminder | 10:00 AM IST | Query overdue invoices → send tiered reminders | ✅ Built |
| daily-evening-summary | 7:00 PM IST | Production + inventory → send template | 🔲 Planned (tier_2+) |
| low-stock-alert | 7:00 PM IST | Inventory below reorder level → alert | 🔲 Planned (tier_2+) |
| compliance-reminder | 8:00 AM IST | Upcoming deadlines → notify | 🔲 Planned (tier_3) |

### Event-Triggered (database webhook)
| Workflow | Trigger | Action | Status |
|----------|---------|--------|--------|
| order-completed | orders.status → 'completed' | Prompt invoice generation | 🔲 Planned |
| payment-received | payments INSERT | Update invoice status | 🔲 Planned |
| inventory-low | inventory below reorder | Suggest vendor PO | 🔲 Planned |
```

Also update the callback routes list at the top (lines 11-21): `/api/whatsapp/menu` is deprecated. Add a note:
```
/api/whatsapp/menu       DEPRECATED — retained for potential future admin tooling, not called by any active workflow
```

---

## Fix 7 (MEDIUM): Table count drift across docs

**CLAUDE.md** says 23 tables. Count the actual tables defined in `docs/database/SCHEMA.md` and the actual migrations in `supabase/migrations/`. Update all three references to the real number:
- `CLAUDE.md` line that says "23 tables"
- `docs/BUILD_GUIDE.md` Sprint 1 checklist line 187: "All 16 database tables created with RLS"
- `docs/database/SCHEMA.md` header if it mentions a count

Count carefully — include the tables added in later sprints (dialect tables, corrections, platform_admins, pending_orders, etc.).

---

## Fix 8 (MEDIUM): `src/lib/ai/dialect-learner.ts` line 432 — `type SupabaseAdmin = any`

**Fix:** Replace:
```ts
type SupabaseAdmin = any;
```
With:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
type SupabaseAdmin = SupabaseClient<Database>
```

If `SupabaseClient` and `Database` are already imported elsewhere in the file, just reference them. Don't duplicate imports.

---

## Fix 9 (MEDIUM): Create `.env.example`

CLAUDE.md's project structure lists `.env.example` as a tracked file, but it doesn't exist.

**Fix:** Create `.env.example` at the project root using the env var list from CLAUDE.md's "Environment Variables" section. Use empty values with comments. Also add `N8N_API` if it exists in `.env.local` (check and include any env vars in `.env.local` that aren't in CLAUDE.md — document what they're for).

Format:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI APIs
DEEPSEEK_API_KEY=
OPENROUTER_API_KEY=

# ... (continue with all vars from CLAUDE.md)
```

---

## Fix 10 (LOW): `docs/BUILD_GUIDE.md` Sprint 1 checklist — wrong table count

**Line 187:** `All 16 database tables created with RLS` — this was the Sprint 1 target but the actual count has grown. 

**Fix:** Change to match reality. If Sprint 1 only created 16 and later sprints added more, clarify:
```
- [ ] All Sprint 1 database tables created with RLS (16 core tables)
```
And add a note that later sprints added dialect tables, pending_orders, platform_admins, corrections, etc.

---

## Verification Pass

After all fixes, do a final check:

1. **Grep for `user_metadata` in all docs:** `grep -rn "user_metadata" docs/` — every remaining reference should either (a) be in the context of "don't use this" / migration fallback, or (b) be the `_current_role()` fallback logic. No doc should instruct building new code that writes to `user_metadata` for auth.

2. **Grep for `sender phone` org lookup in docs:** `grep -rn "sender phone" docs/` — no doc should instruct looking up org by sender phone. Org lookup is always by `phone_number_id`.

3. **Grep for single-layer webhook auth:** `grep -rn "META_WHATSAPP_APP_SECRET" docs/` — every mention should be in the context of the two-layer model, not as the sole auth mechanism.

4. **Scale consistency:** `grep -rn "0-10\|0\.00-1\.00\|0.85\|8\.0" docs/` — all eval gate thresholds should use the 0.00-1.00 scale. Zero references to 0-10 should remain.

5. **Verify no doc references a file that doesn't exist** in `src/` or `n8n/workflows/`.

6. **CLAUDE.md ↔ Playbook cross-check:** Read `CLAUDE.md` "AI Integration Rules" (lines 168-180), "WhatsApp Rules" (lines 184-194), and "Data Integrity Rules" (lines 157-164). Then read `docs/ai/vyaops_prompt_playbook.md` end-to-end. Confirm every rule, constraint, and architectural decision in CLAUDE.md is reflected in the playbook. If anything in CLAUDE.md has no corresponding mention in the playbook, add it to the playbook's Safety Rules section.

7. **Playbook ↔ MESSAGE_PIPELINE.md cross-check:** The playbook's flow (Steps 0-7) and MESSAGE_PIPELINE.md's "Canonical Order Flow" describe the same pipeline from different angles. Verify they agree on: message routing, n8n handoff points, which steps log vs. act, echo handling, and the pending_orders state machine. Flag any contradictions.

---

## Files to DELETE

These files serve no purpose and should be removed from the project:

| File | Reason |
|------|--------|
| `src/app/api/whatsapp/menu/route.ts` | Self-documented as DEPRECATED (line 1). Not called by any n8n workflow or code path. The guided menu flow it served no longer exists in the customer-initiated echo-confirmed architecture. If needed later, rebuild from scratch — the current code references the old trigger-based model. |
| `docs/IMPLEMENTATION_GUIDE.md` | *Only if it exists* — the audit flagged it but the file was not found on disk. Check if it exists; if so, it's an orphan doc not referenced by CLAUDE.md or any other doc. Delete it. |

**Do NOT delete** these — they're stale but still referenced or serve as placeholders:
- `src/config/whatsapp-menus.ts` — imported by the menu route. Delete it ONLY if you delete the menu route.
- `src/lib/whatsapp/interactive.ts` — imported by the menu route. Check if anything else imports it. If only the menu route uses it, delete alongside the menu route. If other code uses `buildMainMenu` etc., keep it.

Before deleting `src/app/api/whatsapp/menu/route.ts`, run:
```bash
grep -rn "whatsapp/menu" src/ --include="*.ts" --include="*.tsx"
grep -rn "buildMainMenu\|buildCustomerList\|buildVendorList" src/ --include="*.ts" --include="*.tsx"
grep -rn "SUBMENU_DEFS\|whatsapp-menus" src/ --include="*.ts" --include="*.tsx"
```
If nothing else references these, delete the route + `src/config/whatsapp-menus.ts` + the three functions from `src/lib/whatsapp/interactive.ts` (or the whole file if nothing else uses it).

---

## Summary of all files touched

**Docs modified:**
- `docs/ai/vyaops_prompt_playbook.md` — Fix 0: eval scale to 0.00-1.00, add webhook auth step, add n8n handoff, add internal API auth rule, add pending_orders constraint, verify prompt matrix
- `docs/ai/EVAL_LOOP.md` — Fix 1: fix auto_process wording + add CRITICAL warning
- `docs/security/RLS_POLICIES.md` — Fix 2: fix org_dictionary to use `_current_org_id()`
- `docs/BUILD_GUIDE.md` — Fix 3: fix auth metadata, webhook auth, org lookup, table count
- `docs/infrastructure/DEPLOYMENT.md` — Fix 4: fix webhook auth to two-layer
- `docs/architecture/MESSAGE_PIPELINE.md` — Fix 5: fix orchestration boundary webhook auth
- `docs/infrastructure/N8N_PIPELINE.md` — Fix 6: add status column, mark unbuilt workflows
- `CLAUDE.md` — Fix 7: update table count if needed
- `docs/database/SCHEMA.md` — Fix 7: update table count if needed

**Code modified:**
- `src/lib/ai/dialect-learner.ts` — fix `any` type

**Files created:**
- `.env.example`

**Files deleted:**
- `src/app/api/whatsapp/menu/route.ts` (+ related dead imports, after dependency check)
- `docs/IMPLEMENTATION_GUIDE.md` (if it exists)
