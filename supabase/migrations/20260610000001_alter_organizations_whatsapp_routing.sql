-- Add WhatsApp routing columns to organizations.
-- whatsapp_phone_number_id: the Meta/Dualhook Phone Number ID of the connected number.
-- This is the primary key used to map inbound webhooks to the correct org.
-- whatsapp_display_number: fallback matching when phone_number_id is not yet set.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_display_number   TEXT;

-- Only one org may own a given phone_number_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_phone_number_id
  ON organizations (whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;

COMMENT ON COLUMN organizations.whatsapp_phone_number_id IS
  'Meta Cloud API / Dualhook Phone Number ID. Used for primary org lookup on inbound webhooks.';

COMMENT ON COLUMN organizations.whatsapp_display_number IS
  'Human-readable WhatsApp number (e.g. "919XXXXXXXXX"). Fallback for org lookup when phone_number_id is not yet configured.';
