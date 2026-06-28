-- S8.2 follow-up (#3): tier_source — distinguish a billing-granted tier from a manual comp.
--
-- CLAUDE.md rule 7: tier is set ONLY by the Razorpay webhook after payment. The ONE authorized
-- exception is a platform-admin manual override (/api/admin/set-tier) for beta users / comps.
-- This column makes that exception legible and self-healing:
--   - 'billing' : tier was granted by the Razorpay webhook (the normal path).
--   - 'comp'    : tier was set manually by a platform admin (free/beta override).
-- The webhook resets tier_source → 'billing' whenever it sets a tier, so a real payment
-- transparently reclaims a comped org; set-tier sets it → 'comp'. Default 'billing' is correct
-- for every existing org (all current tiers came from signup default or the webhook).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tier_source TEXT NOT NULL DEFAULT 'billing'
    CHECK (tier_source IN ('billing', 'comp'));
