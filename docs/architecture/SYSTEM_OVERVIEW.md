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
