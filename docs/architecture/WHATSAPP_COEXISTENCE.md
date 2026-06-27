# WhatsApp Coexistence — VyaOps

## What It Is
Meta feature (2024+) allowing WhatsApp Business App and Cloud API on same number simultaneously.
India fully supported. Dualhook handles Coexistence onboarding via Embedded Signup and Webhook Override.

## How It Works
- Factory owner's WhatsApp Business App unchanged (same number, chats, groups, calls)
- Meta Cloud API mirrors messages bidirectionally; webhooks routed to our server via Dualhook Webhook Override
- Our system receives ALL messages via webhook:
  - **Customer inbound:** field = `messages`, `from` = customer phone
  - **Owner outbound (echoes):** field = `smb_message_echoes` (or `message_echoes` — see below), `from` = business number, `to` = customer phone
- Bot is invisible by default — reads and classifies silently; only posts drafts and confirmations when owner signals affirmation

## Message Echoes — How the Owner Drives the Bot

**What echoes are:** When the owner types and sends a reply from his WhatsApp Business App (on his phone), Dualhook forwards that outbound message as an echo to our webhook. This is the mechanism that lets the owner's natural conversational replies trigger bot actions — without any special interface.

**Critical setup requirement:** Dualhook must have `smb_message_echoes` subscribed as a webhook field. Without this subscription, the owner's replies are invisible to the system and the draft+ok flow cannot function.

**Field name verification:** The exact field name Dualhook uses (`smb_message_echoes` vs `message_echoes`) must be verified against a live echo during testing. Our webhook handler accepts both field names until confirmed. During Dualhook onboarding: send a message FROM the connected number and check what field name appears in n8n executions and in `whatsapp_messages.is_echo`.

**Echo payload shape:**
```json
{
  "field": "smb_message_echoes",
  "value": {
    "metadata": { "phone_number_id": "PHONE_NUMBER_ID", "display_phone_number": "91XXXXXXXXXX" },
    "messages": [{
      "id": "wamid.echo789",
      "from": "91XXXXXXXXXX",
      "to": "919876543210",
      "type": "text",
      "text": { "body": "haa mehulbhai, thai jase" },
      "timestamp": "1717401700"
    }]
  }
}
```
- `from` = business/owner number (same as `metadata.display_phone_number`)
- `to` = customer phone — used as `chat_phone` to correlate with `pending_orders`

**Echo loop prevention:** The bot's own outbound messages also arrive as echoes. Before processing any echo, check the `wamid` against `whatsapp_messages` (direction = 'outbound'). If matched, discard. See MESSAGE_PIPELINE.md for the two-layer prevention rule.

## Customer-Initiated, Echo-Confirmed Model

The bot is NOT owner-initiated (old model). The flow is:
1. Customer messages the owner's number naturally
2. Bot classifies silently and creates a `pending_order` (no reply sent)
3. Owner's natural reply (echo) → bot classifies as AFFIRM/DECLINE/UNRELATED
4. On AFFIRM → bot posts a visible ORDER DRAFT to the chat
5. Owner types "ok" → bot creates the order and posts confirmation
6. Owner types "ok 15 june" → same, plus sets delivery_date

The owner never needs to learn any interface. He just replies naturally in his existing WhatsApp chats.

## Onboarding (customer setup)
1. Verify WhatsApp Business App v2.24.17+
2. Dualhook Coexistence onboarding via Embedded Signup (QR scan or web flow, 5-10 minutes)
3. **Subscribe smb_message_echoes webhook field in Dualhook dashboard**
4. Set `organizations.whatsapp_phone_number_id` to the Meta Phone Number ID for this org
5. Configure webhook routing (phone → tenant mapping)
6. Input master data (customers with normalized phones, products, vendors)
7. Configure preferences (language, schedule times, thresholds)
8. 10-minute demo + first order hand-held (verify echo appears in n8n + DB)
Total: <30 minutes, zero disruption

## In-app Embedded Signup (Onboarding Wizard — Step 6)

The onboarding wizard's "Connect WhatsApp" step runs Meta's Embedded Signup directly in
the browser, using **Dualhook's** tech-provider Meta app (we never hold Dualhook's app secret).

**Flow:**
1. Client loads the Facebook JS SDK with `NEXT_PUBLIC_FB_APP_ID` and calls `FB.login()` with
   `config_id = NEXT_PUBLIC_FB_CONFIG_ID`, `response_type: 'code'`,
   `override_default_response_type: true`, and Coexistence extras
   (`featureType: 'whatsapp_business_app_onboarding'`).
2. Meta posts a `WA_EMBEDDED_SIGNUP` `message` event back to the page carrying the connected
   `phone_number_id` + `waba_id`. The `FB.login` callback returns the short-lived auth `code`.
3. Client sends `{ code, phoneNumberId, wabaId, displayPhoneNumber }` to the `connectWhatsApp`
   server action.
4. Server forwards to Dualhook (`src/lib/whatsapp/dualhook.ts` → `finalizeEmbeddedSignup`,
   `POST {DUALHOOK_API_BASE}/embedded-signup`, `Authorization: Bearer DUALHOOK_API_KEY`).
   **Dualhook** exchanges the code for the WABA token, subscribes the app + `smb_message_echoes`,
   and returns the verified number details. We never see the access token.
5. Server stores `whatsapp_phone_number_id` (PRIMARY org-lookup key), `whatsapp_display_number`,
   `whatsapp_phone`, and `whatsapp_connected = true` on the org.

**Config-gated:** when `NEXT_PUBLIC_FB_APP_ID` / `NEXT_PUBLIC_FB_CONFIG_ID` are unset, the step
shows manual instructions + a "connect later" skip instead of a broken SDK call. The owner can
always finish onboarding and connect later from Settings.

**Env:** `NEXT_PUBLIC_FB_APP_ID`, `NEXT_PUBLIC_FB_CONFIG_ID`, `NEXT_PUBLIC_FB_GRAPH_VERSION`
(optional, default `v21.0`), `DUALHOOK_API_KEY`, `DUALHOOK_API_BASE` (optional).

## Bot Activation Rules (replaces old Opt-In Trigger Model)

**Rule A — Bot silence:** Bot NEVER sends a message to a customer chat except:
1. Order/modification/cancellation draft after owner affirmation
2. Confirmation message after owner "ok"
3. `/status` summary when the owner types `/status` in that chat

**Rule B — Draft + ok always required:** No state-changing DB write without the visible draft + owner "ok". The eval gate's `auto_process` only means "post draft without asking for clarification" — never "skip the ok".

**Rule C — Echo loop prevention:** Wamid-check first, text signature second. See MESSAGE_PIPELINE.md.
