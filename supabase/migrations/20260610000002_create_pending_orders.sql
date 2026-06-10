-- Pending order state machine.
-- Tracks customer messages that have been classified as actionable (NEW_ORDER,
-- MODIFY_ORDER, CANCEL_ORDER) but have not yet been confirmed by the owner.
-- State transitions: detected → draft_posted → confirmed | cancelled | expired.

CREATE TABLE pending_orders (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID         NOT NULL REFERENCES organizations(id),

  -- Customer identity: customer_id is null when sender is unknown or unmatched.
  -- customer_phone is the canonical chat identity (normalized, no +).
  customer_id         UUID         REFERENCES customers(id),
  customer_phone      TEXT         NOT NULL,

  -- What the customer is requesting
  intent              TEXT         NOT NULL CHECK (intent IN ('NEW_ORDER', 'MODIFY_ORDER', 'CANCEL_ORDER')),

  -- For MODIFY_ORDER and CANCEL_ORDER: the target open order
  target_order_id     UUID         REFERENCES orders(id),

  -- Full AI extraction stored as-is: raw values, matched ids, confidences, eval score, alternatives
  extraction          JSONB        NOT NULL DEFAULT '{}'::jsonb,

  -- State machine
  state               TEXT         NOT NULL DEFAULT 'detected'
                      CHECK (state IN ('detected', 'draft_posted', 'confirmed', 'cancelled', 'expired')),

  -- Message tracking
  source_message_id   TEXT         NOT NULL,   -- wamid of the customer message that triggered detection
  draft_message_id    TEXT,                    -- wamid of the draft we posted (set on draft_posted)

  -- Set after successful owner confirmation
  confirmed_order_id  UUID         REFERENCES orders(id),

  -- Lazy expiry: checked and applied on next relevant event (no cron needed)
  expires_at          TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '24 hours'),

  -- Standard columns
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- Standard trigger
CREATE TRIGGER set_pending_orders_updated_at
  BEFORE UPDATE ON pending_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Primary lookup: find active pending for a given customer chat
CREATE INDEX idx_pending_orders_active
  ON pending_orders (organization_id, customer_phone, state)
  WHERE deleted_at IS NULL;

-- Expiry sweep index
CREATE INDEX idx_pending_orders_expires
  ON pending_orders (expires_at)
  WHERE state IN ('detected', 'draft_posted');

-- INVARIANT: only one active (detected or draft_posted) pending_order per
-- (organization_id, customer_phone). Application code must expire the old one
-- before inserting a new one for the same chat. The index enforces the invariant.
CREATE UNIQUE INDEX idx_pending_orders_one_active
  ON pending_orders (organization_id, customer_phone)
  WHERE state IN ('detected', 'draft_posted') AND deleted_at IS NULL;

-- Standard RLS: service-role writes, same tenant-isolation pattern as other tables.
-- Dashboard can read pending_orders for display purposes.
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_orders_org_isolation ON pending_orders
  USING (organization_id = (
    SELECT organization_id FROM users
    WHERE supabase_auth_id = auth.uid()
    LIMIT 1
  ));
