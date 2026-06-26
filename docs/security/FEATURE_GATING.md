# Feature Gating — VyaOps

## Feature → Tier Map
```
tier_1: dashboard, orders, invoices, customers, vendors, settings, whatsapp_orders, whatsapp_invoices, whatsapp_vendor_po, daily_summaries, payment_reminders
tier_2: + production, quality, inventory, cash_flow, auto_mode, whatsapp_production, whatsapp_inventory, rupee_saved_counter
tier_3: + compliance, sop_builder, advanced_analytics, cash_flow_forecast, custom_reports
```

## Enforcement: middleware.ts (route-level), API routes (endpoint-level), WhatsApp menu (dynamic per tier)
## Upsell: locked features show value preview + upgrade CTA, not hard blocks
## User limits: tier_1=2, tier_2=5, tier_3=10. Additional ₹499/user/month
## Add-ons: tally_sync, extra_whatsapp, worker_attendance, custom_industry. Stored in feature_addons table.

## Single source of truth (no drift)
`src/config/features.ts` is authoritative for BOTH "which tier owns a feature" and "which
tier a gated route needs":
- `FEATURE_ACCESS[featureKey] → tier` — the map above, in code.
- `ROUTE_FEATURE[routePrefix] → featureKey` — maps each gated route to its feature.
- `requiredTierForRoute(pathname)` derives the route's required tier as
  `FEATURE_ACCESS[ROUTE_FEATURE[prefix]]`.

`middleware.ts` MUST call `requiredTierForRoute()` — it must NEVER hardcode a second
prefix→tier table. Hardcoding one creates two sources of truth that silently drift when a
feature is re-tiered. Gated route prefixes today: `/production`, `/quality`, `/inventory`,
`/cash-flow` (tier_2); `/compliance`, `/sop-builder` (tier_3).

## Tier provisioning is server-authoritative (NEVER trust the client)
- **Tier is NEVER set from client input.** Self-signup ALWAYS provisions `tier_1`, regardless
  of which plan the signup form selected. The selected paid plan is only a *preference* that
  routes the new owner to Settings → Billing to complete Razorpay checkout.
- **A paid tier is granted ONLY by the Razorpay webhook** (`subscription.authenticated` /
  `subscription.charged`) after a successful payment. See `docs/billing/RAZORPAY_INTEGRATION.md`.
- Rationale: `organizations.tier` is the access key. If signup honored a client-chosen
  `tier_3`, anyone could craft a request and unlock every gated feature for free
  (`billing_status` defaults to `'active'`, so a billing check alone would not stop it).

## billing_status is a second gate for tier_2+ routes (defense in depth)
- Middleware gates tier_2+ routes on BOTH sufficient tier AND
  `billing_status ∈ {active, grace_period}`.
- `suspended` / `cancelled` orgs immediately lose access to tier_2+ routes (redirected to
  `/settings`) even if `organizations.tier` still reads `tier_2`/`tier_3`. tier_1 routes are
  never billing-gated.
