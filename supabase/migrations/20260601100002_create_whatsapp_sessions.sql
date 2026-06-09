-- Conversation state for WhatsApp guided flows (Opt-In Trigger Model).
-- One row per active conversation (organization_id + sender_phone). The `state`
-- JSONB accumulates the in-progress selection as the owner steps through a
-- guided flow (e.g. selected_customer_id -> selected_product_id -> quantity).
-- Short-lived: rows expire and are overwritten on the next flow. NOT an audit
-- record — the immutable log lives in whatsapp_messages + audit_log.

CREATE TABLE whatsapp_sessions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID         NOT NULL,
  sender_phone     TEXT         NOT NULL,
  state            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  expires_at       TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- One live session per (org, sender). Upserts target this constraint.
  UNIQUE (organization_id, sender_phone)
);

CREATE INDEX idx_whatsapp_sessions_lookup ON whatsapp_sessions(organization_id, sender_phone);
CREATE INDEX idx_whatsapp_sessions_expiry ON whatsapp_sessions(expires_at);

-- Keep updated_at fresh on every write (same trigger fn used by all tables).
CREATE TRIGGER set_whatsapp_sessions_updated_at
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
