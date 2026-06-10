# Message Processing Pipeline

## Architecture Overview

**NEW MODEL (customer-initiated, echo-confirmed):**

- **CUSTOMERS** message the factory owner's WhatsApp number as they always have
- The **owner** reads and replies from his own phone, as he always has
- **Coexistence mode** gives both directions via webhooks:
  - Customer messages → `messages` field
  - Owner's replies sent from his phone → `smb_message_echoes` field
- The **bot is invisible** until useful. It silently classifies customer messages and uses the owner's natural replies (caught via echo) as signals.
- **State-changing writes require a visible draft + explicit owner "ok".** Always.

---

## Webhook Fields

### Customer Inbound (`field: "messages"`)
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "919XXXXXXXXX",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{ "profile": { "name": "Mehul Patel" }, "wa_id": "919876543210" }],
        "messages": [{
          "id": "wamid.customer123",
          "from": "919876543210",
          "type": "text",
          "text": { "body": "rajubhai, 500 piece valve body mokljo, urgent che" },
          "timestamp": "1717401600"
        }]
      },
      "field": "messages"
    }]
  }]
}
```
- `from` is the **customer phone**
- `metadata.phone_number_id` identifies the **org** (maps to `organizations.whatsapp_phone_number_id`)

### Owner Echo (`field: "smb_message_echoes"` — also accept `"message_echoes"`)

Dualhook forwards the owner's outbound replies as echoes. The exact field name (`smb_message_echoes` vs `message_echoes`) must be verified against a live Dualhook echo during testing (Phase 8). Keep both until confirmed.

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "919XXXXXXXXX",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "messages": [{
          "id": "wamid.owner456",
          "from": "919XXXXXXXXX",
          "to": "919876543210",
          "type": "text",
          "text": { "body": "haa mehulbhai, thai jase" },
          "timestamp": "1717401700"
        }]
      },
      "field": "smb_message_echoes"
    }]
  }]
}
```
- `from` = business number (owner's phone / the connected number)
- `to` / `recipient` = customer phone — this becomes `chat_phone`
- **Field name:** Dualhook may use `smb_message_echoes` or `message_echoes`. Accept both.

---

## Canonical Order Flow (NEW)

```
1. Customer: "rajubhai, 500 piece valve body mokljo, urgent che"
   → Webhook receives messages field → org lookup by phone_number_id
   → Customer identified by sender phone (normalize: strip +, spaces, leading 91)
   → Unknown sender → log-only, NO action, NO pending_order
   → Known customer → DeepSeek classifies NEW_ORDER (high confidence)
   → Extract entities (product, quantity) → fuzzy-match customer + product
   → Upsert pending_orders (state: 'detected', source_message_id = wamid)
   → Bot sends NOTHING

2. Owner replies from his phone: "haa mehulbhai, thai jase"
   → Webhook receives smb_message_echoes field
   → LOOP GUARD: check if echo wamid is in whatsapp_messages.outbound → skip if yes
   → Log to whatsapp_messages (direction: 'outbound', is_echo: true, chat_phone = to)
   → Forward to n8n (messageType: 'owner_echo', chat_phone, text, active pending_order)
   → Flow engine: active pending in 'detected' state
   → classifyOwnerReply → AFFIRM
   → Build ORDER DRAFT and send to chat (visible to BOTH customer and owner):
       📋 Order Draft
       500 × Valve Body (CI)
       Customer: Mehul Patel
       Ready by: — (reply "ok <date>" to set)
       Reply "ok" to confirm · /cancel to discard
   → pending_order state → 'draft_posted', store draft_message_id

   → DECLINE → pending_order state → 'cancelled'. Bot stays silent.
   → UNRELATED → no state change. Bot stays silent.

3. Owner replies "ok" (or "ok 15 june")
   → Echo caught → parseConfirmation → confirmed: true, promisedDate: "2026-06-15" | null
   → Order created in orders table:
       status: 'confirmed', source: 'whatsapp', delivery_date: promisedDate
       idempotency key: hash(org_id:customer_id:product_id:qty:date_hour)
       audit logged
   → Bot sends to the chat:
       ✅ Order Confirmed — ORD-2606-001
       500 × Valve Body (CI) | Urgent
       Ready by: 15 June (if set)
   → pending_order state → 'confirmed', confirmed_order_id set

4. Owner replies "/cancel" while draft is posted
   → pending_order state → 'cancelled'. No message.

5. Anything unrecognizable while 'draft_posted' → UNRELATED, keep waiting.
   Pending orders expire 24h after creation (state → 'expired', lazily on next event).
```

---

## Org Lookup

**Primary:** `organizations.whatsapp_phone_number_id = change.value.metadata.phone_number_id`
**Fallback:** `organizations.whatsapp_display_number = change.value.metadata.display_phone_number`

If no org found: log (masked phone) and exit. Never process orphaned webhooks.

---

## Customer Identification

- Match `msg.from` (customer phone) against `customers.phone`
- Normalize phones before comparison: strip `+`, spaces, and leading `91` variations
- Use `src/lib/utils/phone.ts` `normalizePhone()` for ALL phone comparisons
- Unknown sender → log only, NO pending_order, NO reply

---

## pending_orders State Machine

```
detected ──(AFFIRM echo)──→ draft_posted ──(owner "ok")──→ confirmed
    │                            │
    ├──(DECLINE echo)────────→ cancelled
    ├──(24h expires)────────→ expired
    │                            ├──(owner /cancel)──→ cancelled
    │                            ├──(24h expires)───→ expired
    │                            └──(UNRELATED echo)→ [stay draft_posted]
    └──(superseded by new detection)──→ expired [old one]
```

- Only ONE pending_order in (`detected`, `draft_posted`) per (organization_id, customer_phone) — enforced by partial unique index
- New detection while one is active: expire old one in application code, then insert new

---

## Echo Loop Prevention (CRITICAL)

The bot's own outbound messages come back as echoes. Prevention has TWO layers:

1. **Primary (wamid check):** Before processing any echo, check if `echo.id` exists in `whatsapp_messages` with `direction = 'outbound'`. If yes → **ignore entirely**.
2. **Secondary (text signature):** If the echo body matches known draft/confirmation message prefixes (`📋 Order Draft`, `✅ Order Confirmed`), also skip.

Without this the bot replies to itself forever.

---

## Orchestration Boundary

Steps 1–3 run in `/api/webhooks/whatsapp`:
- HMAC-SHA256 verification using META_WHATSAPP_APP_SECRET
- Acknowledge with 200 immediately (< 1 second)
- Org lookup by phone_number_id
- Customer identification by sender phone
- whatsapp_messages logging (inbound + echoes)
- Echo loop guard (wamid check)
- Forward to n8n: `{ message, chatPhone, orgId, messageType, isCommand?, buttonReply?, listReply? }`

Steps 4–8 run via n8n → `/api/whatsapp/flow`:
- Flow engine: `handleCustomerMessage` / `handleOwnerEcho`
- AI classification (DeepSeek) and eval gate (Qwen)
- pending_orders upserts
- Draft building and sending (`/api/whatsapp/send`)
- Order creation via shared `src/lib/orders/create-order.ts`

n8n branches:
- `customer_text` → `/api/whatsapp/flow` (handleCustomerMessage)
- `owner_echo` → `/api/whatsapp/flow` (handleOwnerEcho)
- `status_update` / unknown → log only (no WhatsApp reply ever)

n8n NEVER calls DeepSeek, Meta, or Supabase directly.

---

## Owner Slash Commands (via echo)

When echo text starts with `/`, `isCommand: true` is set in the n8n forward:
- `/status` → fetch open orders for that customer, send summary to chat
- `/cancel` → cancel active pending_order for that chat
- `/edit <text>` → re-run extraction on `<text>`, re-post draft
- `/order <text>` → manual trigger — run customer detection flow but skip AFFIRM, post draft immediately

---

## Three Hard Rules

**A. Bot silence:** The bot NEVER sends a message to a customer chat EXCEPT:
1. The order/modification/cancellation draft after owner affirmation
2. The confirmation message after owner "ok"
3. The `/status` summary when the owner types `/status`
No greetings, no auto-replies, no "I didn't understand."

**B. Draft + ok required:** NO state-changing DB write ever happens without the visible draft + explicit owner "ok". The eval gate's `auto_process` decision means "post the draft without asking for clarification" — it NEVER means "skip the owner's ok".

**C. Echo loop prevention:** See above — wamid check first, text signature second.

---

## Scheduled Messages (n8n cron — unchanged)
| Time | Message | Tier |
|------|---------|------|
| 7:30 AM | Production plan for today | tier_2+ |
| 9:00 AM | Overdue invoice summary | tier_1+ |
| 7:00 PM | Production summary + inventory snapshot | tier_2+ |
| 6:00 PM | Open orders summary | tier_1+ |
