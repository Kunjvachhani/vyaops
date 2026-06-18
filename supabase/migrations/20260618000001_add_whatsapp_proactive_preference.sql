-- Add proactive notification preference to organizations
ALTER TABLE organizations
  ADD COLUMN whatsapp_proactive_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN whatsapp_proactive_set_at   TIMESTAMPTZ;

-- Backfill: existing orgs get TRUE (opted in by default)
-- whatsapp_proactive_set_at stays NULL for existing orgs (implies "default, never explicitly set")

COMMENT ON COLUMN organizations.whatsapp_proactive_enabled IS
  'Whether this org receives proactive WhatsApp notifications (morning summary, payment reminders, compliance alerts). UX preference, not a Meta marketing requirement — all templates are Utility category.';
COMMENT ON COLUMN organizations.whatsapp_proactive_set_at IS
  'When the owner last changed the proactive notification preference. NULL = never explicitly set (using default).';

-- ONBOARDING REQUIREMENT (future — Sprint 8 onboarding task):
-- When the onboarding flow is built, Step 5 (Connect WhatsApp) must include a
-- checkbox, default checked:
--   "Send me daily order summaries, payment reminders, and compliance alerts via WhatsApp"
-- It writes to organizations.whatsapp_proactive_enabled (and sets
-- whatsapp_proactive_set_at = now() when the owner explicitly toggles it).
