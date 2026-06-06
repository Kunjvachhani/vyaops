# n8n Workflow Pipeline

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
| daily-morning-summary | 7:30 AM IST | Query open orders + plan → format → send |
| daily-evening-summary | 7:00 PM IST | Query production + inventory → format → send |
| payment-reminder | 9:00 AM IST | Query overdue invoices → send reminders |
| low-stock-alert | 7:00 PM IST | Check inventory vs reorder level → alert |
| compliance-reminder | 8:00 AM IST | Check upcoming deadlines → notify |

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
