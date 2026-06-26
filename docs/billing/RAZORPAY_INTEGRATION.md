# Razorpay Integration — VyaOps

## Pricing Tiers
| Tier | Name | Price | Razorpay Plan ID |
|------|------|-------|-----------------|
| tier_1 | WhatsApp Vyapar | ₹7,999/mo | plan_tier1_monthly |
| tier_2 | Factory OS | ₹14,999/mo | plan_tier2_monthly |
| tier_3 | Factory Pro | ₹24,999/mo | plan_tier3_monthly |

## Setup Fee: ₹14,999 one-time (waived for first 5 customers)

## Add-Ons
| Add-On | Price | Razorpay Item |
|--------|-------|--------------|
| Additional user | ₹499/user/mo | addon_extra_user |
| Tally sync | ₹2,999/mo | addon_tally |
| Extra WhatsApp number | ₹2,999/number/mo | addon_extra_wa |
| Worker attendance | ₹1,999/mo | addon_attendance |

## Flow
0. Signup: org is ALWAYS created at `tier_1` (the signup plan picker is a preference only —
   it never grants a paid tier). A paid selection routes the new owner to Settings → Billing.
1. Owner selects/confirms plan on Settings → Billing (or /pricing)
2. Razorpay Checkout opens (UPI, card, netbanking)
3. First payment → Razorpay creates subscription with UPI Autopay mandate
4. Webhook: subscription.authenticated → activate org, set tier
5. Monthly: Razorpay auto-debits → webhook: subscription.charged → extend tier_valid_until
6. Payment failure → webhook: payment.failed → retry 3x over 5 days
7. All retries fail → webhook: subscription.halted → start grace period (7 days)
8. Grace period expires → downgrade to tier_1 features
9. 30 days unpaid → suspend account
10. 90 days unpaid → archive data

> **SECURITY — tier is webhook-authoritative:** `organizations.tier` is the access key
> enforced by middleware. It is set ONLY by this webhook handler (steps 4–5) after a real
> payment, never from client input at signup. See `docs/security/FEATURE_GATING.md`
> ("Tier provisioning is server-authoritative"). Middleware additionally gates tier_2+ routes
> on `billing_status ∈ {active, grace_period}`, so a halted/suspended org loses paid access
> even if its `tier` column has not yet been downgraded.

## Webhook Handler: POST /api/webhooks/razorpay
1. Verify X-Razorpay-Signature
2. Parse event type
3. Update organizations table (tier, billing_status, tier_valid_until)
4. Log to billing_events table
5. Send WhatsApp notification to owner (payment success/failure)

## Early Adopter Pricing
First 20 customers: 20% discount for 12 months.
Tracked via `early_adopter` boolean on organizations table.
After 12 months: auto-upgrade to standard pricing with 30-day notice.
