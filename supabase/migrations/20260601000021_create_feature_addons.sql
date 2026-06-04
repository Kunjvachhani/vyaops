-- Tracks which add-ons each organization has purchased/enabled.
-- Unique constraint (partial index) prevents duplicate active add-ons per org.

CREATE TABLE feature_addons (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  addon_key         TEXT        NOT NULL
                                  CHECK (addon_key IN ('tally_sync', 'extra_numbers', 'worker_attendance', 'custom_industry')),
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  razorpay_addon_id TEXT,
  activated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON feature_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Prevents duplicate active addon per org (ignores soft-deleted rows).
CREATE UNIQUE INDEX idx_feature_addons_unique_active
  ON feature_addons(organization_id, addon_key)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_feature_addons_org ON feature_addons(organization_id) WHERE deleted_at IS NULL;
