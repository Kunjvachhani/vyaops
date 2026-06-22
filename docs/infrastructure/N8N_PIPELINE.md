# n8n Workflow Pipeline

## Architecture: n8n proxied through Next.js

The master handler (`n8n/workflows/master-message-handler.json`) does NOT call
Meta or DeepSeek directly. It is orchestration only — every external action goes
back through the Next.js app, so all WhatsApp sends, AI calls, and writes flow
through one audited, credential-holding layer.

```
Meta → /api/webhooks/whatsapp (verify HMAC, log, decide isTriggered)
     → forwards {message, sender, orgId, messageType, isTriggered} to n8n webhook
     → n8n routes (guided / AI / log-only) and calls BACK into Next.js:
         /api/ai                  intent → resolve → eval → routing decision
         /api/whatsapp/menu       build main/sub menu (returns or sends)
         /api/whatsapp/send       forward a built Meta message → Cloud API
         /api/session/store       guided-flow conversation state
         /api/analytics/log-intent PostHog capture (Branch C, no reply)
         /api/errors/log          error sink (Error Trigger branch)
         /api/orders              order creation
```

All callbacks authenticate `x-internal-api-key` against `INTERNAL_API_KEY`. n8n
holds only `APP_URL` + `INTERNAL_API_KEY` (workflow env), no Meta/DeepSeek keys.

## Workflow Categories

### Message-Triggered (real-time, <15s processing)
| Workflow | Trigger | Action |
|----------|---------|--------|
| whatsapp-message-handler | Meta Cloud API webhook (via Dualhook Webhook Override) | Routes to sub-workflows based on intent |
| order-intake | Intent=NEW_ORDER | Parse → match → eval → confirm → create |
| invoice-generator | Intent=INVOICE_REQUEST or order completed | Generate PDF → save → send |
| production-logger | Intent=PRODUCTION_UPDATE | Parse → validate → save → update inventory/orders |
| inventory-checker | Intent=INVENTORY_CHECK | Query stock → format → respond |

### Scheduled (cron-based)
| Workflow | Schedule | Action |
|----------|----------|--------|
| daily-order-summary    | 8:00 AM IST  | Query yesterday orders + today production + overdue → send template |
| daily-evening-summary  | 7:00 PM IST  | Query production + inventory → send template |
| payment-reminder       | 10:00 AM IST | Query overdue invoices → send tiered reminders |
| low-stock-alert        | 7:00 PM IST  | Check inventory vs reorder level → alert |
| compliance-reminder    | 8:00 AM IST  | Check upcoming deadlines → notify |

### Event-Triggered (database webhook)
| Workflow | Trigger | Action |
|----------|---------|--------|
| order-completed | orders.status → 'completed' | Prompt invoice generation |
| payment-received | payments INSERT | Update invoice status |
| inventory-low | inventory below reorder | Suggest vendor PO |

## Error Handling
- All workflows: 3 retries with exponential backoff (1s, 2s, 4s)
- AI API failure: fallback to guided prompts (never fail silently)
- WhatsApp send failure: retry 3x, then queue for manual send
- Database write failure: retry, then alert admin via Telegram/Hermes
- All errors logged to Sentry + admin notification
