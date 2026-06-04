# WhatsApp Coexistence — VyaOps

## What It Is
Meta feature (2024+) allowing WhatsApp Business App and Cloud API on same number simultaneously.
India fully supported. AiSensy BSP supports Coexistence onboarding.

## How It Works
- Factory owner's WhatsApp Business App unchanged (same number, chats, groups, calls)
- Cloud API mirrors messages bidirectionally via AiSensy
- Our system receives ALL messages via webhook
- Messages echoed: bot replies visible in owner's app, owner's manual replies visible to our API

## Onboarding (customer setup)
1. Verify WhatsApp Business App v2.24.17+
2. AiSensy Coexistence onboarding (QR scan, 5-10 minutes)
3. Configure webhook routing (phone → tenant mapping)
4. Input master data (customers, products, vendors)
5. Configure preferences (language, schedule times, thresholds)
6. 10-minute demo + first order hand-held
Total: <30 minutes, zero disruption

## Opt-In Trigger Model
Bot NEVER auto-replies by default. Only activates on:
- Guided prompt buttons (📦 Orders, 🧾 Invoice, etc.)
- Trigger prefixes (/order, /stock, /invoice)
- Scheduled automations (morning/evening summaries, reminders)
- Event-based alerts (order complete, payment received, low stock)
All other messages: system reads + classifies + logs, but stays SILENT.

## Auto-Mode Graduation (Month 3+)
After 500+ processed messages + eval benchmark > 90% accuracy:
Owner can opt-in to auto-reply for high-confidence (>90%) actionable messages.
Toggle on/off anytime via WhatsApp ("auto on" / "auto off") or dashboard.
