# n8n Workflow Pipeline

## Architecture: n8n proxied through Next.js

The master handler (`n8n/workflows/master-message-handler.json`) does NOT call
Meta or DeepSeek directly. It is orchestration only — every external action goes
back through the Next.js app, so all WhatsApp sends, AI calls, and writes flow
through one audited, credential-holding layer.

```
Meta → /api/webhooks/whatsapp (two-layer webhook auth, log, echo guard, org lookup)
     → forwards {message, chatPhone, orgId, messageType, isCommand?} to n8n webhook
     → n8n routes (customer_text / owner_echo / log-only) and calls BACK into Next.js:
         /api/whatsapp/flow       flow engine: handleCustomerMessage / handleOwnerEcho
         /api/ai                  intent → resolve → eval → routing decision
         /api/whatsapp/send       forward a built Meta message → Cloud API
         /api/whatsapp/menu       DEPRECATED — retained for potential future admin tooling, not called by any active workflow
         /api/session/store       guided-flow conversation state
         /api/analytics/log-intent PostHog capture (log-only branch, no reply)
         /api/errors/log          error sink (Error Trigger branch)
         /api/orders              order creation
```

All callbacks authenticate `x-internal-api-key` against `INTERNAL_API_KEY`. n8n
holds only `APP_URL` + `INTERNAL_API_KEY` (workflow env), no Meta/DeepSeek keys.

## Workflow Categories

### Message-Triggered (real-time, <15s processing)
| Workflow | Trigger | Action | Status |
|----------|---------|--------|--------|
| master-message-handler | Meta Cloud API webhook (via Dualhook Webhook Override) | Routes to flow engine based on message type | ✅ Built |
| order-intake | Intent=NEW_ORDER | Parse → match → eval → draft → confirm → create | ⚠️ Handled inside master-handler + /api/whatsapp/flow, not a separate workflow |
| invoice-generator | Intent=INVOICE_REQUEST or order completed | Generate PDF → save → send | 🔲 Planned |
| production-logger | Intent=PRODUCTION_UPDATE | Parse → validate → save → update inventory/orders | 🔲 Planned |
| inventory-checker | Intent=INVENTORY_CHECK | Query stock → format → respond | 🔲 Planned |

### Scheduled (cron-based)
| Workflow | Schedule | Action | Status |
|----------|----------|--------|--------|
| daily-order-summary | 8:00 AM IST | Query yesterday orders + today production + overdue → send template | ✅ Built |
| payment-reminder | 10:00 AM IST | Query overdue invoices → send tiered reminders | ✅ Built |
| morning-production-plan | 7:30 AM IST | Query in-production orders → send plan to owner | ✅ Built (tier_1+) |
| evening-production-summary | 6:30 PM IST | Query today batches → totals + yield % + high-rejection alert | ✅ Built (tier_2+) |
| daily-evening-summary | 7:00 PM IST | Query production + inventory → send template | 🔲 Planned (tier_2+) |
| low-stock-alert | 7:00 PM IST | Check inventory vs reorder level → alert | 🔲 Planned (tier_2+) |
| compliance-reminder | 8:00 AM IST | Check upcoming deadlines → notify | 🔲 Planned (tier_3) |

### Event-Triggered (database webhook)
| Workflow | Trigger | Action | Status |
|----------|---------|--------|--------|
| order-completed | orders.status → 'completed' | Prompt invoice generation | 🔲 Planned |
| payment-received | payments INSERT | Update invoice status | 🔲 Planned |
| inventory-low | inventory below reorder | Suggest vendor PO | 🔲 Planned |

## Error Handling
- All workflows: 3 retries with exponential backoff (1s, 2s, 4s)
- AI API failure: fallback to guided prompts (never fail silently)
- WhatsApp send failure: retry 3x, then queue for manual send
- Database write failure: retry, then alert admin via Telegram/Hermes
- All errors logged to Sentry + admin notification
