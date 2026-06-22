# System Overview — VyaOps

## Two-Tier Architecture
1. WhatsApp Layer: Daily operations via factory owner's existing number (Coexistence)
2. Web Platform: Dashboard, analytics, compliance, SOPs (Next.js PWA)

## Data Flow
```
WhatsApp Message → Meta Webhook (via Dualhook Webhook Override) → n8n → DeepSeek (generate) → Qwen 3.7 Max (eval) → Supabase → Response via Meta Cloud API
Web Dashboard ← Supabase Realtime ← same database
```

## Multi-Tenancy
- Single database, single application instance
- Row-Level Security isolates tenant data at PostgreSQL level
- organization_id on every table
- Feature gating via tier field on organizations table

## Coexistence Model
Factory owner keeps existing WhatsApp Business App unchanged. Cloud API runs in parallel.
Customers message the owner's number naturally. Bot classifies silently; the owner's natural
replies (captured as echoes via `smb_message_echoes` webhook field) drive the draft+ok
confirmation loop. See WHATSAPP_COEXISTENCE.md and MESSAGE_PIPELINE.md for details.

## Outbound Message Categories

There are two fundamentally different kinds of outbound WhatsApp message. They are governed by
different rules and must not be conflated.

### 1. Autonomous bot messages (unchanged from the S2-R revised flow)
The bot sends to a customer chat on its own initiative in exactly three cases — no others (this is
Rule A, "Bot silence", in CLAUDE.md):
1. **Order/modification/cancellation drafts** — posted after owner affirmation.
2. **Confirmation messages** — sent after the owner types "ok".
3. **`/status` summaries** — sent only when the owner types `/status` in that specific chat.

No greetings, auto-replies, or "I didn't understand" messages. This list is closed.

### 2. Owner-initiated dashboard sends (new — courier model)
Distinct from autonomous behavior: the owner explicitly triggers a send from the web dashboard, and
the bot acts purely as a **courier** relaying what the owner chose to send. Because the owner is
driving the action (not the bot acting on its own), this does not fall under, or relax, the Rule A
bot-silence list above.

- **Currently:** the **"Send via WhatsApp"** button on an invoice (`POST /api/invoices/[id]/send-whatsapp`)
  delivers the invoice PDF to the customer's number as a document message.
- **Constraint — 24h customer-service window:** WhatsApp only permits free-form (non-template)
  messages inside the 24-hour window opened by the customer's last inbound message. The current
  implementation uses `sendRawMessage`, so it **only works inside that window**. Outside it, Meta
  requires a pre-approved template.
- **Future work (not blocking S3.7):** a template-based send path for out-of-window delivery. This
  needs `TemplateParameter` (`src/types/whatsapp.ts`) extended to support a document header
  parameter (`type: 'document'` with a `document: { link, filename }` object), which the current
  text/payload-only shape cannot express.

## Production Planning Philosophy

**Core principle:** Promised dates are owner-set, progress is observed — the system never auto-schedules.

### How dates are set
`delivery_date` on the `orders` table is the owner's promised ready date. It is set at the moment
the owner confirms an order by typing "ok 15 june" (flow engine parses the date and writes it).
If no date is given at confirmation time, `delivery_date` is null. The owner can update it later
via the web dashboard.

### How progress is tracked
`production_batches` records actual output per shift. Sum of `quantity_produced` across all batches
for an order is the current production progress. The `/status` command surfaces this to the chat.

### Future Production Dashboard (Sprint 5)
The Production page will be a **drag-to-reorder priority queue** sorted by `delivery_date` by default.
Features:
- Each order card shows: promised date, quantity remaining, pace (units/day from recent batches)
- **Advisory pace warnings only:** "Promised 15 June — at current pace: 18 June ⚠️"
- Owner reorders by drag to reprioritize. The system records the new sequence but never auto-commits dates.
- The system NEVER suggests a new date or automatically pushes a deadline. Advisory display only.

**What we are NOT building:**
- Auto-scheduling or constraint-based planning
- Machine capacity modeling
- Automatic date suggestions or commitment
- Notifications to customers about progress (only the owner can share updates via his WhatsApp)
