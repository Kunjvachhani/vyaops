# Message Processing Pipeline

## Webhook Flow
```
1. Meta receives WhatsApp message on the Cloud API number
2. Meta sends webhook to POST /api/webhooks/whatsapp (routed via Dualhook Webhook Override)
3. Verify Meta X-Hub-Signature-256 using META_WHATSAPP_APP_SECRET (REJECT if invalid)
4. Acknowledge with 200 immediately (< 1 second)
5. Queue message for async processing
6. Lookup organization by sender phone number
7. Log raw message to whatsapp_messages table
8. Check: is this a triggered message? (button tap, prefix, reply to bot)
   - NO → classify silently, log, do NOT respond. Exit.
   - YES → continue pipeline
9. Send to DeepSeek V4 Pro: classify intent + extract entities
10. Send AI output to Qwen 3.7 Max (via OpenRouter): eval gate scoring
11. Route based on score:
    ≥0.85 → auto-process
    0.70-0.84 → confirm with buttons
    0.50-0.69 → clarify with options
    <0.50 → show guided menu
12. On confirmation → create/update database records
13. Trigger downstream workflows (inventory update, order progress, etc.)
14. Send response via Meta Cloud API (graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages)
15. Log outcome to whatsapp_messages (eval_score, was_processed, processing_result)
```

**Orchestration boundary:** steps 1–8 run in `/api/webhooks/whatsapp`, which then
forwards `{message, sender, orgId, messageType, isTriggered}` to the n8n master
handler. Steps 9–14 are orchestrated by n8n calling back into Next.js routes
(`/api/ai` covers 9–11; `/api/orders` covers 12–13; `/api/whatsapp/send` covers 14).
n8n never calls DeepSeek or Meta directly. See `docs/infrastructure/N8N_PIPELINE.md`.

## Webhook Payload (Meta Cloud API format)
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "91XXXXXXXXXX", "phone_number_id": "PHONE_NUMBER_ID" },
        "contacts": [{ "profile": { "name": "Raju Bhai" }, "wa_id": "919876543210" }],
        "messages": [{
          "id": "wamid.xxx",
          "from": "919876543210",
          "type": "text|interactive|button",
          "text": { "body": "rajubhai no order 500 piece valve body" },
          "interactive": { "type": "list_reply|button_reply", "list_reply": { "id": "new_order" } },
          "timestamp": "1717401600"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

## Scheduled Messages (n8n cron workflows)
| Time | Message | Tier |
|------|---------|------|
| 7:30 AM | Production plan for today | tier_2+ |
| 9:00 AM | Overdue invoice summary | tier_1+ |
| 7:00 PM | Production summary + inventory snapshot | tier_2+ |
| 6:00 PM | Open orders summary | tier_1+ |

## WhatsApp Interactive Components
- Quick Reply Buttons: 3 max, for confirmations and top-level nav
- List Messages: 10 options, for customer/product/vendor selection
- WhatsApp Flows: Multi-step forms for production logging, new customer setup
All components dynamically generated based on org tier + master data.
