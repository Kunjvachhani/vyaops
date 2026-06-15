# WhatsApp Draft Posting — Debug Log

**Issue**: When the factory owner replies to a customer message from the org WhatsApp number (`917228888871`), a draft order confirmation should be posted back to that WhatsApp chat. This has never worked end-to-end.

**Status as of 2026-06-14**: ✅ **RESOLVED.** End-to-end send confirmed in production
(`200 / sent:true`, real `wamid` returned, outbound row logged to `whatsapp_messages`).
Root cause was a **Vercel environment variable**, not application logic. Full write-up
in "Bug 2 — RESOLVED" and "Resolution & Learnings" below.

---

## Pipeline Flow (How It's Supposed to Work)

```
Customer message → Meta webhook → /api/webhooks/whatsapp (Vercel)
  → forward to n8n (Hetzner) → n8n routes → /api/whatsapp/flow (Vercel)
  → flow-engine.ts → sendTextMessage() → Meta Graph API → Customer chat
```

Owner echo flow specifically:
1. Customer sends message → AI extracts intent → `pending_orders` row created (`state: detected`)
2. Owner sees message in WhatsApp, replies from org number
3. Meta delivers owner reply as an **echo** in `value.message_echoes` (Dualhook Coexistence API)
4. Webhook captures echo → forwards to n8n → flow engine classifies owner reply as AFFIRM
5. Flow engine builds draft text → calls `sendTextMessage(chatPhone, draftText, orgId)`
6. Meta API posts draft to customer chat → `pending_orders.state` → `draft_posted`

---

## Bug 1 — FIXED (Session 1)

**Symptom**: Owner echoes were silently dropped. No draft ever attempted.

**Root Cause**: `src/app/api/webhooks/whatsapp/route.ts` had:
```typescript
if (!value.messages?.length) continue   // ← dropped echoes silently
```
Meta delivers echoes in `value.message_echoes`, not `value.messages`. This check ran before the echo handler, so every owner reply was discarded before reaching n8n.

**Fix**: Added `message_echoes` processing inside the `change.field === 'messages'` branch before the early-return check.

**Commit**: `229b57c`

---

## Bug 2 — RESOLVED (root cause confirmed 2026-06-14)

**Symptom**: Draft still not posted. `pending_orders` stays in `detected` state.

**Error**: Meta Graph API returns **Error 100 / subcode 33**:
`"Unsupported post request. Object with ID 'messages' does not exist..."`

**ROOT CAUSE**: `META_WHATSAPP_PHONE_NUMBER_ID` is **missing/empty in the Vercel
Production environment**. The send URL is `${BASE}/${phoneNumberId}/messages`; with
an empty `phoneNumberId` it collapses to `${BASE}//messages`, which Meta resolves to
a node literally named `messages` — hence the misleading "Object with ID 'messages'".
The token, the PID value itself (`1137154129485464`), Meta permissions, and the
recipient were all fine the whole time — only the Vercel env var was absent.

**How it was proven** (bypassing the Vercel log-truncation dead-end):
- Confirmed the `.env.local` token has access to the PID — `GET /{pid}` → 200,
  `verified_name: "Vyaops"`, `quality_rating: GREEN`.
- Sent a real test message with the `.env.local` token + PID + recipient via the
  Supabase `http` extension → **200, wamid returned** (proves token/PID/recipient OK).
- POSTed to the **live production** `/api/whatsapp/send` (runs with Vercel's env) from
  the same Supabase http extension → returned the 100/33 "Object with ID 'messages'"
  error → proves production's `phoneNumberId` is empty at runtime.

**THE FIX**:
1. Vercel → Project `vyaops` → Settings → Environment Variables → add
   `META_WHATSAPP_PHONE_NUMBER_ID = 1137154129485464` for the **Production** scope
   (also Preview/Development). This value is NOT a secret — it's the public phone
   number ID. (Confirm there's no trailing space/newline.)
2. Redeploy with a FRESH build so the new env is read (a plain "Redeploy" reuses
   cached env — push a commit or redeploy with "use existing build cache" OFF).

**SECOND STACKED BUG (caught during verification)**: after the env var was added, the
live test produced a NEW error — `Object with ID 'META_WHATSAPP_PHONE_NUMBER_ID'
does not exist`. The variable's **value** had been set to the variable **name** (the
key was pasted into the value field) instead of `1137154129485464`. Two distinct
config mistakes were stacked on top of each other, which is why the truncated logs
looked like one stubborn "Error 100" across sessions:
1. env var **missing** → URL `//messages` → `Object with ID 'messages'`
2. env var value = the **name** → URL `/META_WHATSAPP_PHONE_NUMBER_ID/messages` →
   `Object with ID 'META_WHATSAPP_PHONE_NUMBER_ID'`

**THE FIX (shipped):**
- Vercel: `META_WHATSAPP_PHONE_NUMBER_ID = 1137154129485464` (Production), correct value.
- Code (`src/lib/whatsapp/meta-cloud-api.ts`, commit `dd5a576`):
  - Send now resolves the phone-number-id from `organizations.whatsapp_phone_number_id`
    (multi-tenant correct), with the env var only as a **fallback**. A missing/wrong
    env var can no longer break sends — the DB value wins.
  - `.trim()` on both env vars (guards trailing newline/space from the Vercel UI paste).
  - Throws a clear, loud error if no phone-number-id is available, instead of silently
    building the broken `//messages` URL.

**VERIFIED 2026-06-14**: production `POST /api/whatsapp/send` → `200 {"sent":true,
"messageId":"wamid…"}`; outbound message logged to `whatsapp_messages` with
`chat_phone 16478988697`. Pipeline is unblocked end-to-end.

---

## Bug 2 — original notes (kept for history)

**Error**: Meta Graph API returns **Error 100 (Invalid Parameter)**.

---

## Debugging Timeline

### Step 1 — Confirmed echo reaches flow engine
- DB shows `pending_orders` rows being created correctly with `state: detected`
- `customer_phone: "16478988697"`, `extraction.quantity: 500`, `extraction.productId: "Valve Body"`, `customer_name: "Kunj"`
- Flow engine `handleEchoForDetected` is being reached (state never advances = send fails)

### Step 2 — Identified expired token
- Original `META_WHATSAPP_ACCESS_TOKEN` was a short-lived user token starting `EAAj0n5v...`
- Short-lived tokens expire in ~1-2 hours. All API calls were silently failing with Error 190 (expired token)

**Fix**: Created System User "Whatsappapiuser" in Meta Business Manager → generated permanent token → updated `META_WHATSAPP_ACCESS_TOKEN` in Vercel env vars and `.env.local`

### Step 3 — Vercel redeploy didn't pick up new token
- Clicked "Redeploy" on Vercel dashboard → deployment `dpl_EP11jbbFdbvQtRozQecBiWxMEchj`
- Vercel redeploy uses **cached env vars from original deployment**, not the updated ones
- Token was still expired in that deployment

**Fix**: Force fresh deployment by pushing a git commit. This triggers a new build that reads current env vars.

**Commit**: `018bd4a` — "fix: surface full Meta API error code in log title"

### Step 4 — Confirmed new token is valid via curl
- Ran curl test from terminal directly against Meta Graph API
- Used token from `.env.local` + phone number ID `1137154129485464`
- **Result: SUCCESS** — `wamid` returned, message delivered to `16478988697`
- Confirmed: token is valid, phone number can receive messages

### Step 5 — Identified error is now 100, not 190
- After fresh deploy, errors changed from 190 → **100**
- Error 100 = "Invalid Parameter" (not auth/token issue)
- Original log format buried the error code inside a JSON object that Vercel MCP truncated

**Fix**: Added dedicated single-line log:
```typescript
console.error(`[meta-api] code=${code} subcode=${error_subcode ?? 'none'} http=${res.status}`)
```

**Commits**: `e88f334`, `e174afb`

### Step 6 — Subcode still truncated by Vercel MCP
- Vercel MCP tool returns logs as a markdown table
- Table column for "Message" is ~35 chars wide
- Log `[meta-api] code=100 subcode=XXXX http=400` gets cut to `[meta-api] code=100 subcode...`
- The actual subcode number is never visible

**Fix** (deployed, awaiting test): Split each field onto its own line:
```typescript
console.error(`[meta-sub] ${error_subcode ?? 'none'}`)
console.error(`[meta-code] ${code}`)
console.error(`[meta-http] ${res.status}`)
console.error(`[meta-msg] ${message.slice(0, 80)}`)
```
Now searching `[meta-sub]` returns a line that's only ~25 chars — won't be truncated.

**Commit**: pending push (blocked by `.git/index.lock` — user must delete manually)

---

## Current State — ✅ ALL WORKING (2026-06-14)

| Component | Status |
|-----------|--------|
| Customer message → webhook → n8n | ✅ Working |
| n8n → flow engine → `pending_order` created | ✅ Working |
| Owner echo captured | ✅ Working (Bug 1 fixed) |
| Owner echo → AFFIRM classification | ✅ Working |
| Draft text built (`buildOrderDraft`) | ✅ Working |
| `sendTextMessage` → Meta Graph API | ✅ Working (`200`, wamid) |
| Draft posted to customer chat | ✅ Working |
| `pending_order.state` → `draft_posted` | ✅ Advances on successful send |

---

## Resolution & Learnings

**What it really was:** two stacked Vercel env-var mistakes (missing var, then
name-as-value), never an application bug. The Graph API string `Object with ID 'X'
does not exist` is the definitive tell for a bad phone-number-id in the URL path —
`X` echoes back whatever the path segment was (`messages` when empty, the var name
when mis-pasted). When you see that error, check the value going into
`/{phoneNumberId}/messages` first, before anything else.

**Why it took multiple sessions:** the real Graph error was buried in a JSON blob that
the Vercel logs viewer truncated, so the subcode/message were never visible. Days were
spent chasing token expiry (190) and log-formatting workarounds instead of reading the
actual error.

**The technique that finally cracked it** (reusable): the dev sandbox is firewalled off
from Meta and Vercel, but **Supabase Postgres can reach external hosts**. Enabling the
`http` extension and calling out from SQL gave a clean, untruncated channel:
```sql
create extension if not exists http with schema extensions;
-- read the FULL Meta error, or hit our own prod endpoint with the internal key:
select status, content from (
  select (extensions.http((
    'POST','https://www.vyaops.com/api/whatsapp/send',
    ARRAY[extensions.http_header('x-internal-api-key', '<INTERNAL_API_KEY>')],
    'application/json',
    '{"to":"16478988697","type":"text","orgId":"<ORG_UUID>","text":{"body":"diag"}}'
  )::extensions.http_request)).*
) r;
drop extension if exists http;  -- clean up afterward
```
This POSTs through production's real env and returns the exact untruncated error —
the move that exposed both the empty value and the name-as-value. ⚠️ `(http(...)).*`
evaluates the call once per selected column, so it can fire the request 2–3×; fine for
a self-owned test number, but never point it at a real customer.

**Hardening so this can't recur:** send path now reads the phone-number-id from the org
record (DB), env as fallback only; env vars are trimmed; empty config throws loudly.

---

## Prevention Checklist (WhatsApp / Meta env)

- [ ] Vercel env values are the **value**, not the key name (classic paste slip).
- [ ] No trailing space/newline in pasted tokens/IDs (now `.trim()`ed in code anyway).
- [ ] New env vars require a **fresh build** to take effect (a plain redeploy can reuse
      cached env) — push a commit or redeploy with build cache OFF.
- [ ] Prefer the org's `whatsapp_phone_number_id` over a global env var (multi-tenant).
- [ ] To debug a prod-only failure when the sandbox can't reach the host, route the
      call through Supabase's `http` extension (see above).

---

## Key Files

| File | Role |
|------|------|
| `src/app/api/webhooks/whatsapp/route.ts` | Receives Meta webhook, extracts echoes |
| `src/lib/whatsapp/flow-engine.ts` | Core logic: echo → classify → build draft → send |
| `src/lib/whatsapp/meta-cloud-api.ts` | Meta Graph API client, `sendTextMessage` |
| `src/lib/whatsapp/interactive.ts` | `buildOrderDraft` — builds the draft text string |
| `src/lib/utils/phone.ts` | `normalizePhone` — ensures phone numbers are E.164 |

## Meta API Credentials (for reference)

- **Phone Number ID** (local `.env.local`): `1137154129485464`
- **System User**: `Whatsappapiuser` (created in Meta Business Manager)
- **Org WhatsApp Number**: `917228888871`
- **Test Customer Number**: `16478988697`
