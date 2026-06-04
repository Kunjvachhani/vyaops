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
