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
Bot only responds when explicitly triggered (Opt-In Trigger Model).
See WHATSAPP_COEXISTENCE.md and MESSAGE_PIPELINE.md for details.
