# VyaOps — End-to-End Live Testing Manual

**Audience:** You (founder/tester), running a full manual test pass from a blank database.
**Last reset:** 2026-06-28 — remote DB `manufacturing-os` (`wnraksutkqewtvuompmt`) wiped clean.

> **What "blank" means right now**
> - **Wiped to 0 rows:** organizations, users, customers, vendors, products, orders, invoices, payments, vendor_orders, production_batches, inventory, inventory_movements, compliance_tasks, sop_documents, audit_log, whatsapp_messages, whatsapp_sessions, pending_orders, billing_events, feature_addons, eval_benchmark, ai_usage, org_dictionary, corrections.
> - **Auth users:** all deleted **except** your platform-admin login `1kunjvachhani@gmail.com`.
> - **Storage:** invoices / sop-images / org-logos buckets emptied.
> - **Preserved on purpose:** `industry_dictionary` (367 rows), `global_dictionary`, `platform_admins` (your admin), and the full schema (all migrations).

> ⚠️ **Important caveat for signup testing:** Because your admin email `1kunjvachhani@gmail.com` is preserved in `auth.users`, you **cannot reuse it to create a fresh tenant account** (Supabase will reject "email already registered"). **Use a different email** for the new owner signup (e.g. `owner+test1@yourdomain.com` or a Gmail `+alias`). Phone OTP testing similarly needs a fresh number.

---

## 0. How the system fits together (read first)

```
WhatsApp (customer / owner phone)
        │  Meta Cloud API + Dualhook (Coexistence + Webhook Override)
        ▼
[Next.js] /api/webhooks/whatsapp   ──auth: HMAC OR ?t= URL token──▶ verifies, logs, looks up org
        │  forwards {messageType, message, chatPhone, orgId, ...}  +  x-internal-api-key
        ▼
[n8n] master-message-handler  (webhook path /whatsapp-message)
        │  Message Router (switch on messageType)
        │   • customer_text / button_reply / list_reply ─▶ Customer Flow
        │   • owner_echo                                ─▶ Owner Echo Flow
        │   • everything else                           ─▶ Log Only
        ▼  calls BACK into Next.js (never Meta/DeepSeek directly)
[Next.js] /api/whatsapp/flow  ──auth: x-internal-api-key──▶ flow-engine
        │  AI pipeline (dialect → classify → resolve → eval gate) → draft → owner "ok" loop
        ▼
[Next.js] /api/whatsapp/send ─▶ Meta Cloud API ─▶ message back to the chat
```

Plus **7 scheduled n8n workflows** (cron) that pull summaries/reminders from Next.js GET endpoints and push them out via `/api/whatsapp/send`.

**Three planes you will test:**
1. **Web dashboard** — signup → onboarding wizard → every feature, gated by tier.
2. **WhatsApp + n8n** — the customer-order → owner-confirm loop and scheduled jobs.
3. **Platform admin** — `/admin` (your preserved account), cross-org.

---

## 1. Pre-flight checklist

Run these before any testing. Don't skip — most "it didn't work" reports trace back to one of these.

### 1.1 Decide where the app runs
WhatsApp webhooks need a **public HTTPS URL**. You have two options:

| Mode | Use when | App URL |
|------|----------|---------|
| **Local + tunnel** | Iterating fast | `npm run dev` (port 3000) + `cloudflared tunnel --url http://localhost:3000` (or ngrok). Point `NEXT_PUBLIC_APP_URL` and the Dualhook/Meta webhook + n8n `APP_URL` at the tunnel URL. |
| **Deployed (Vercel)** | True "live" test | Your Vercel production URL. Set all env vars in Vercel project settings. |

> `.env.local` currently has `NEXT_PUBLIC_APP_URL=http://localhost:3000`. For WhatsApp tests, this **must** be the public URL n8n and Meta can reach. n8n is hosted at `https://n8n.vyaops.com` and calls back to whatever `APP_URL` env var is set **inside n8n** — make sure that points to your reachable app.

### 1.2 Verify services are up

```bash
# 1. Type + lint clean (build won't ship broken)
npm run type-check
npm run lint

# 2. Dev server
npm run dev            # http://localhost:3000

# 3. Confirm DB connectivity + blank state (expect all zeros)
#    Run in Supabase SQL editor or psql:
```
```sql
SELECT
  (SELECT count(*) FROM organizations) orgs,
  (SELECT count(*) FROM users) users,
  (SELECT count(*) FROM orders) orders,
  (SELECT count(*) FROM whatsapp_messages) wa_msgs,
  (SELECT count(*) FROM industry_dictionary) dict,   -- should be 367
  (SELECT count(*) FROM platform_admins) admins;     -- should be 1
```

### 1.3 Confirm required env vars are present (names, not values)

Web app minimum: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.
AI: `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`.
WhatsApp: `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_VERIFY_TOKEN`, `META_WHATSAPP_APP_SECRET`, `DUALHOOK_API_KEY`, `WHATSAPP_WEBHOOK_URL_TOKEN`, `NEXT_PUBLIC_FB_APP_ID`, `NEXT_PUBLIC_FB_CONFIG_ID`.
n8n: `N8N_WEBHOOK_URL`, `INTERNAL_API_KEY` (must match the value n8n sends).
Billing: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
Cron: `CRON_SECRET`.

### 1.4 Confirm webhooks are registered
- **Meta/Dualhook → WhatsApp webhook:** `https://<app>/api/webhooks/whatsapp?t=<WHATSAPP_WEBHOOK_URL_TOKEN>` with verify token = `META_WHATSAPP_VERIFY_TOKEN`. Subscribed to `messages` + `smb_message_echoes`.
- **Razorpay → billing webhook:** `https://<app>/api/webhooks/razorpay`, signing secret = `RAZORPAY_WEBHOOK_SECRET`, events: `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `payment.failed`.
- **n8n:** all 8 workflows **imported and ACTIVE**, with `APP_URL` + `INTERNAL_API_KEY` env vars set in n8n.

---

## 2. PART A — Web dashboard E2E (signup → onboarding → features)

### A1. Signup (creates org @ tier_1)
1. Go to `http://localhost:3000/signup`.
2. Fill: **email** (use a NEW email, not your admin one), password, full name, company name, city, industry (Foundry), optionally address + GSTIN.
3. Pick any plan in the plan picker — **note:** the picker is a *preference only*. Signup always provisions **tier_1**; a tier_2/tier_3 selection just routes you to billing checkout afterward.
4. Submit.

**Expected**
- New row in `organizations` with `tier = 'tier_1'`, `onboarding_status = 'pending'`.
- New row in `users` with `role = 'owner'`, linked `supabase_auth_id`.
- New `auth.users` row; `app_metadata` contains `{ org_id, role: 'owner' }` (NOT just user_metadata).
- Redirect into onboarding (or billing if you picked a paid plan).

**Verify**
```sql
SELECT o.name, o.tier, o.onboarding_status, u.role, u.email
FROM organizations o JOIN users u ON u.organization_id = o.id
ORDER BY o.created_at DESC LIMIT 1;
```
**Security spot-check:** even if you tamper the form to send `tier=tier_3`, the org must still be `tier_1`. ✔ if true.

### A2. Onboarding wizard (10 steps)
Route: `/onboarding`. Steps as built:

| Step | Screen | What to test | Writes to |
|------|--------|--------------|-----------|
| 1 | Language | Pick Gujarati/Hindi/English | `organizations.language_preference` + `locale` cookie |
| 2 | Company | Name, address, GSTIN, industry, **logo upload** | `organizations` + `org-logos` bucket |
| 3 | Customers | Add manually **and** import a CSV/XLSX/PDF contact file (≤5MB) | `customers` (phones canonicalized; bad phones → null, batch still saves) |
| 4 | Products | Name + price (entered in ₹, stored as paise) | `products.unit_price_paise` |
| 5 | Vendors | Name, phone, material | `vendors` |
| 6 | Open orders | Pick customer+product+qty+date | `orders` (status `confirmed`, ORD- number) |
| 7 | Open invoices | Customer + outstanding total + due date | `invoices` (status `sent`, INV- number) |
| 8 | Dictionary | Click generate → AI (or heuristic) aliases → review/confirm each | `org_dictionary` (source `onboarding_ai`) |
| 9 | Connect WhatsApp | Dualhook Embedded Signup (FB popup) | `organizations.whatsapp_*`, `whatsapp_connected=true` |
| 10 | Done | Finish | `onboarding_status='complete'`, `onboarded_at` |

**Test each step's persistence:** refresh mid-wizard — data already saved should survive (each step commits via its own server action).

**Key checks**
- **Step 2 logo:** appears in `org-logos/<org_id>/logo.png`; shows on dashboard later.
- **Step 3 import:** upload a messy CSV — confirm rows parse into the review table, invalid phones don't crash the batch.
- **Step 4 price:** enter ₹1,500 → DB stores `150000` paise.
- **Step 8 dictionary:** if DeepSeek is reachable you get AI aliases; if not, deterministic heuristics (e.g. "Valve Body" → `valve body`, `valvebody`, `vb`, `valve`). Either way the review list is non-empty when products/customers exist. Confirm a few entries → `org_dictionary` rows become reviewed.
- **Step 9 WhatsApp:** see Part C — you can connect here or test the webhook independently.

**Verify completion**
```sql
SELECT onboarding_status, onboarded_at, whatsapp_connected, logo_url, language_preference
FROM organizations ORDER BY created_at DESC LIMIT 1;
```

### A3. Dashboard home
Go to `/dashboard`. Expect: KPI cards reflect the orders/invoices/customers you seeded in onboarding, in **IST**, money in **₹** (converted from paise), language matching step 1.

### A4. Feature-by-feature (tier_1 features — should all work now)

For each: create → read in list → edit → soft-delete → confirm `deleted_at` set (never hard-deleted) and an `audit_log` row written.

1. **Orders** (`/orders`)
   - Create an order (customer + product + qty + delivery date). Number is `ORD-…`.
   - Edit quantity → optimistic-lock via `updated_at`; audit row added.
   - View order audit trail (`/api/orders/[id]/audit`).
   - Export (`/api/orders/export`) → file downloads.
2. **Invoices** (`/invoices`)
   - Generate invoice from an eligible order (`/api/invoices/eligible-orders`).
   - **PDF**: open `/api/invoices/[id]/pdf` → Puppeteer renders, stored in `invoices` bucket.
   - **Send via WhatsApp**: `/api/invoices/[id]/send-whatsapp` (needs WA connected).
   - Overdue list, summary, export.
3. **Customers** (`/customers`) — create/edit/delete, export, detail view.
4. **Vendors** (`/vendors`)
   - Create vendor; create a **purchase order** (`/vendors/[id]/purchase-orders`); generate PO **PDF**; mark paid.
5. **Settings** (`/settings`) — org profile, language, logo, WhatsApp proactive-message preference toggle.
6. **Cash-flow** (`/cash-flow`) — *tier_2 gated* (see A5); the reminder send endpoint exists at `/api/cash-flow/send-reminder`.

**Soft-delete proof (any entity):**
```sql
SELECT id, name, deleted_at FROM customers WHERE deleted_at IS NOT NULL;   -- row still exists, just flagged
SELECT action, entity_type, entity_id FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

### A5. Tier gating (critical security test) — still tier_1 here
While the org is **tier_1**, try to open paid routes directly in the URL bar:

| Route | Required tier | Expected at tier_1 |
|-------|---------------|--------------------|
| `/production` | tier_2 | **blocked / redirect** |
| `/quality` | tier_2 | blocked |
| `/inventory` | tier_2 | blocked |
| `/cash-flow` | tier_2 | blocked |
| `/compliance` | tier_3 | blocked |
| `/sop-builder` | tier_3 | blocked |

Middleware derives required tier from `FEATURE_ACCESS` via `requiredTierForRoute()` (single source of truth) and additionally requires `billing_status ∈ {active, grace_period}` for tier_2+. **If any paid route opens at tier_1, that's a gating bug — flag it.**

---

## 3. PART B — Billing & tier upgrade (Razorpay)

The **only** legitimate way `organizations.tier` changes is the Razorpay webhook after payment.

### B1. Checkout
1. As the owner, go to billing/upgrade (or `/api/billing/checkout`).
2. Pick tier_2. Complete payment in **Razorpay test mode** (test cards/UPI).

### B2. Webhook flips the tier
On `subscription.activated` / `subscription.charged`, the webhook sets `tier` and `billing_status='active'`, writes `billing_events`.

**Verify**
```sql
SELECT tier, billing_status FROM organizations ORDER BY created_at DESC LIMIT 1;  -- expect tier_2 / active
SELECT event_type, created_at FROM billing_events ORDER BY created_at DESC LIMIT 5;
```

### B3. Re-test gating after upgrade
- `/production`, `/quality`, `/inventory`, `/cash-flow` now **open**.
- `/compliance`, `/sop-builder` still **blocked** (tier_3).
- Upgrade to tier_3 (or simulate `change-plan`) → those open too.

### B4. Downgrade / lapse
- Fire `subscription.halted` → `billing_status='grace_period'`, paid routes **still** work (grace).
- Fire `subscription.cancelled` → `billing_status` lapses, paid routes blocked immediately, but **data is retained** (not deleted).

> Simulate a webhook locally (replace secret + body):
> ```bash
> BODY='{"event":"subscription.activated","payload":{"subscription":{"entity":{"id":"sub_test"}}}}'
> SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" | sed 's/^.* //')
> curl -X POST http://localhost:3000/api/webhooks/razorpay \
>   -H "Content-Type: application/json" -H "x-razorpay-signature: $SIG" -d "$BODY"
> ```
> (You must map a real Razorpay `subscription.id` to your org for the handler to find it — easiest is to run a real test-mode checkout.)

### B5. Now test the tier_2 / tier_3 features
- **Production** (`/production`): create batch, morning plan, evening summary.
- **Quality** (`/quality`).
- **Inventory** (`/inventory`): stock items, adjust stock (`/api/inventory/adjust` → `inventory_movements`), low-stock threshold.
- **Cash-flow** (`/cash-flow`): forecast (tier_3), send reminder.
- **Compliance** (`/compliance`, tier_3): create task with due date + reminder.
- **SOP builder** (`/sop-builder`, tier_3): rich-text SOP (TipTap), image upload (`sop-images` bucket), versioning (`/api/sop/[id]/version`), parent/child.

---

## 4. PART C — WhatsApp + n8n message flows (the core)

This is the heart of the product. **Golden rules being tested:**
- **Rule A (bot silence):** bot only ever sends (1) order/modify/cancel **draft** after owner affirms, (2) **confirmation** after owner "ok", (3) **/status** summary. Nothing else — no greetings, no auto-replies.
- **Rule B (draft + ok):** NO order create/modify/cancel without a visible draft **and** explicit owner "ok".
- **Rule C (echo loop):** bot's own outbound echoes must be ignored.

### C0. Prerequisites
- Org has `whatsapp_connected=true` and a real `whatsapp_phone_number_id` (from onboarding step 9).
- The **customer phone must exist in `customers`** (unknown senders are logged only, no action).
- App is publicly reachable; n8n master-handler is **active**; `INTERNAL_API_KEY` matches.

### C1. Webhook verification (GET handshake)
```bash
curl "https://<app>/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<META_WHATSAPP_VERIFY_TOKEN>&hub.challenge=12345"
# Expect: 12345
```
Wrong token → `403`.

### C2. Webhook auth (POST)
- Valid HMAC (`x-hub-signature-256`) **or** valid `?t=<WHATSAPP_WEBHOOK_URL_TOKEN>` → accepted.
- Neither → `401`.
- `x-dualhook-event: test_ping` → `200` (Dualhook health ping).

### C3. The full order loop (do this on real phones)

> Model: **customer-initiated, echo-confirmed.** The customer writes the order in the chat; the **owner** (on their own WhatsApp, the connected number) approves it. The owner's outbound messages come back as **echoes** and drive the state machine.

1. **Customer sends an order** in their chat with the business, e.g. (Gujarati/Hindi/English mix):
   > "50 valve body joiye, 15 june sudhi"
   **Expected:** `pending_orders` row `state='detected'`. **No outbound message** to the customer (Rule A). Logged in `whatsapp_messages` (inbound).
2. **Owner affirms** (types in that chat something like "haa" / "ok bhej de" — an affirmation):
   **Expected:** bot posts the **📋 Order Draft** into the chat; `pending_orders.state='draft_posted'`.
3. **Owner confirms** with "ok" (optionally with details, e.g. "ok 15 june"):
   **Expected:** order **created** in `orders`, **✅ Order Confirmed** sent, `pending_orders.state='confirmed'`, `confirmed_order_id` set. Idempotent: same order within the hour won't double-create.
4. **Owner "ok" with no pending draft** → nothing happens.

### C4. Modify & cancel
- **Modify:** customer asks to change qty; owner affirms → draft; owner "ok" (with qty) → order updated. If qty ambiguous, bot re-asks (stays `draft_posted`).
- **Cancel (destructive):** requires **explicit YES / હા / हा / haan** — plain "ok" is **not** enough. `/cancel` from the owner cancels the pending draft silently.

### C5. `/status` command (owner only, chat-scoped)
- Owner types `/status` in a specific customer's chat → bot replies with a summary **scoped strictly to that chat's customer** (confirmed + in_production orders).
- `/status` in a chat with no matching customer → silent.
- A **customer** typing `/status` → does nothing (informational queries are never auto-answered).

### C6. Echo-loop prevention (Rule C)
- The bot's own **📋 Order Draft** / **✅ Order Confirmed** / **📦 Your Orders** messages echo back. Confirm they're **ignored**:
  - Layer 1: wamid already logged as outbound → skipped.
  - Layer 2: text matches a bot-message prefix → skipped.
- **Proof it's not looping:** after a full order, the bot sends exactly 2 messages (draft + confirm), not an endless stream.

### C7. Simulate the whole thing without real phones
A script exercises 7 scenarios (order detect, affirm→draft, ok→create, ok-with-no-pending, unknown sender, loop guard, /status scope) against `/api/whatsapp/flow` directly:
```bash
npm run test:webhook
```
> The script's hard-coded customer phones (`919824100001` etc.) matched the **old seed**, which is now wiped. Either (a) create a customer with phone `919824100001` in your new org first, or (b) edit the phone constants at the top of `scripts/test-webhook.ts` to match a customer you created. Without a matching customer, you'll correctly see "unknown sender → log only".

Also test the AI pipeline directly:
```bash
npm run test:ai          # dialect → classify → resolve → eval gate
```

### C8. Verify in DB after WhatsApp tests
```sql
SELECT state, customer_phone, target_order_id, confirmed_order_id, created_at
FROM pending_orders ORDER BY created_at DESC LIMIT 10;

SELECT direction, is_echo, was_triggered, message_type, left(message_body,40)
FROM whatsapp_messages ORDER BY created_at DESC LIMIT 20;
```
- Inbound customer msgs: `direction='inbound'`, `is_echo=false`.
- Owner echoes: `direction='outbound'`, `is_echo=true`; `/status` etc. `was_triggered=true`.

### C9. Watch n8n while testing
In the n8n UI (`https://n8n.vyaops.com`):
- Open **VyaOps — Master Message Handler** → Executions. Each inbound message/echo should produce an execution.
- Confirm the **Message Router** sends `customer_text`/`button_reply`/`list_reply` → **Customer Flow**, `owner_echo` → **Owner Echo Flow**, anything else → **Log Only**.
- Both Customer/Owner flows call `POST {APP_URL}/api/whatsapp/flow`.
- On error, the **Error Trigger** posts to `/api/errors/log` (→ Sentry).

---

## 5. PART D — Scheduled n8n workflows (cron jobs)

7 active scheduled workflows. Each: cron trigger → `GET` a Next.js endpoint → fan out via `POST /api/whatsapp/send` → log intent / errors. **Test by "Execute Workflow" manually in n8n** instead of waiting for the cron time.

| Workflow | Cron (server TZ) | Pulls from | Sends |
|----------|------------------|-----------|-------|
| morning-production-plan | 07:30 daily | `/api/production/morning-plan` | plan to owner |
| daily-order-summary | 08:00 daily | `/api/orders/daily-summary` | order summary |
| compliance-reminder | 09:00 daily | `/api/compliance/upcoming` + `/api/compliance/[id]/reminder` | due tasks |
| payment-reminder | 10:00 daily | `/api/invoices/overdue` + `/api/invoices/[id]/reminder` | overdue chase |
| low-stock-alert | every 6h | `/api/inventory/low-stock-alert` | restock alert |
| evening-production-summary | 18:30 daily | `/api/production/evening-summary` | summary (2 sends) |
| weekly-summary | Sun 09:00 | `/api/analytics/weekly-summary` | weekly digest |

**Test procedure per workflow**
1. Seed the precondition (e.g. for payment-reminder: an invoice with `status='sent'` and `due_date` in the past; for low-stock: inventory below threshold; tier must allow the feature — e.g. low-stock/weekly-summary are tier_2).
2. In n8n, open the workflow → **Execute Workflow**.
3. Confirm: the GET returns the expected rows, `/api/whatsapp/send` fires, the owner receives the message, and `/api/analytics/log-intent` logs it.
4. Errors route to `/api/errors/log`.

> You can also hit the GET endpoints directly to validate payload shape (they require internal auth — pass `x-internal-api-key: $INTERNAL_API_KEY`):
> ```bash
> curl -H "x-internal-api-key: $INTERNAL_API_KEY" http://localhost:3000/api/invoices/overdue
> curl -H "x-internal-api-key: $INTERNAL_API_KEY" http://localhost:3000/api/inventory/low-stock-alert
> ```

### Cron endpoints (Vercel cron, not n8n)
- `/api/cron/savings-snapshot` — guarded by `CRON_SECRET`. Test: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/savings-snapshot` → writes `organizations.savings_snapshot`.

---

## 6. PART E — Platform admin (your preserved account)

Log in as `1kunjvachhani@gmail.com` (the only surviving auth user). This is the **cross-org** plane, separate from tenants.

1. `/admin` — should load (gated by `getPlatformAdmin()` DB lookup + `app_metadata.is_platform_admin` fast path). A **tenant owner must never reach `/admin`** — verify by logging in as the test owner and trying `/admin` → blocked.
2. `/admin/orgs` — list all organizations; you should see your new test org. Drill into `/admin/orgs/[id]`.
3. AI usage tracking, savings snapshot, tier_source columns (S8.2 dashboard).
4. `/admin/recovery` + `/api/admin/restore` + `/api/admin/deleted` — view soft-deleted records and restore.
5. `/api/admin/set-tier` — manually set an org's tier (admin override). Confirm it writes `audit_log` with `changed_by_source='platform_admin'`.

---

## 7. PART F — Security / data-integrity spot checks

Run these throughout — they catch the highest-risk regressions:

1. **Tier can't be self-granted:** tamper signup `tier` field → org still `tier_1` (A1).
2. **Role can't be self-promoted:** `app_metadata.role` is authoritative; editing `user_metadata` from the browser must not grant owner/admin.
3. **RLS isolation:** create a 2nd tenant org; confirm tenant A can't read tenant B's customers/orders (query with each user's anon session).
4. **No hard deletes:** every "delete" sets `deleted_at`; row still present.
5. **Audit completeness:** every mutation appears in `audit_log` with org_id + source.
6. **No sensitive data in logs:** phones masked (`91XXXX…1234`), no tokens/GSTINs/amounts in console or Sentry.
7. **Money integrity:** all amounts stored as integer paise; UI shows ₹ with correct conversion.
8. **Idempotent orders:** same customer+product+qty+hour doesn't create duplicates.
9. **Webhook auth:** unsigned WhatsApp/Razorpay POSTs are rejected (401/400).

---

## 8. Appendix

### 8.1 Suggested test order (fastest happy path)
1. Pre-flight (§1) → 2. Signup with NEW email (§A1) → 3. Full onboarding (§A2) → 4. tier_1 features (§A4) → 5. Tier gating blocked (§A5) → 6. Razorpay upgrade (§B) → 7. tier_2/3 features (§B5) → 8. WhatsApp order loop on real phones (§C3–C6) → 9. n8n scheduled jobs via Execute (§D) → 10. Platform admin (§E) → 11. Security sweep (§F).

### 8.2 Useful verification queries
```sql
-- Full snapshot of your test org
SELECT * FROM organizations ORDER BY created_at DESC LIMIT 1;

-- Everything created under it (replace :org)
SELECT 'customers' t, count(*) FROM customers WHERE organization_id = :org
UNION ALL SELECT 'orders', count(*) FROM orders WHERE organization_id = :org
UNION ALL SELECT 'invoices', count(*) FROM invoices WHERE organization_id = :org
UNION ALL SELECT 'pending_orders', count(*) FROM pending_orders WHERE organization_id = :org
UNION ALL SELECT 'whatsapp_messages', count(*) FROM whatsapp_messages WHERE organization_id = :org;

-- Audit trail
SELECT created_at, action, entity_type, source, changed_by_source
FROM audit_log WHERE organization_id = :org ORDER BY created_at DESC LIMIT 30;
```

### 8.3 Re-running the reset (to start over)
To wipe again between test passes (keeps dictionary + your admin), run this in the Supabase SQL editor:
```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('industry_dictionary','global_dictionary','platform_admins')
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;

-- Keep ONLY your admin auth user
DELETE FROM auth.users WHERE id <> 'b3f770d7-550f-4105-bad5-1e4ac6a59929';
```
Storage can't be cleared via SQL (protected). Clear it with the Storage API / Supabase dashboard (buckets: `invoices`, `sop-images`, `org-logos`), or re-run the project script you used earlier.

### 8.4 Troubleshooting
| Symptom | Likely cause |
|---------|--------------|
| Signup "email already registered" | You reused your admin email — use a different one. |
| Webhook returns 401 | HMAC + `?t=` token both failed; check `WHATSAPP_WEBHOOK_URL_TOKEN` in URL and env. |
| Customer message does nothing | Customer phone not in `customers` (unknown sender = log only), or org `whatsapp_phone_number_id` mismatch. |
| Bot replies to itself | Echo loop guard not firing — check `whatsapp_messages` for the outbound wamid; verify Rule C. |
| n8n calls fail with 401/403 | `INTERNAL_API_KEY` mismatch between n8n and app. |
| Paid route opens at tier_1 | Gating bug — `requiredTierForRoute` / billing_status check; flag it. |
| Scheduled job sends nothing | Precondition rows missing, or tier doesn't include the feature, or `APP_URL` wrong inside n8n. |
| Tier didn't change after payment | Razorpay webhook didn't fire / signature failed / subscription id not mapped to org. |
| AI dictionary step empty | DeepSeek unreachable — heuristic fallback should still fill it; check `DEEPSEEK_API_KEY`. |
```
```

---

*Generated for the post-reset blank-DB test pass on 2026-06-28. Reset preserved: `industry_dictionary`, `global_dictionary`, `platform_admins`, and the admin login `1kunjvachhani@gmail.com`.*
