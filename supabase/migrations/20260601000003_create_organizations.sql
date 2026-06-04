-- Tenant root. Every piece of data belongs to one organization.
-- No organization_id FK on this table — it IS the organization.

CREATE TABLE organizations (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT        NOT NULL,
  gstin                     TEXT,
  address                   TEXT,
  city                      TEXT        NOT NULL,
  state                     TEXT        NOT NULL DEFAULT 'Gujarat',
  phone                     TEXT        NOT NULL,
  email                     TEXT,
  industry_config           TEXT        NOT NULL DEFAULT 'foundry',
  tier                      TEXT        NOT NULL DEFAULT 'tier_1'
                                          CHECK (tier IN ('tier_1', 'tier_2', 'tier_3')),
  tier_valid_until          TIMESTAMPTZ,
  billing_status            TEXT        NOT NULL DEFAULT 'active'
                                          CHECK (billing_status IN ('active', 'grace_period', 'suspended', 'cancelled')),
  razorpay_customer_id      TEXT,
  razorpay_subscription_id  TEXT,
  whatsapp_phone            TEXT,
  whatsapp_connected        BOOLEAN     NOT NULL DEFAULT FALSE,
  auto_mode_enabled         BOOLEAN     NOT NULL DEFAULT FALSE,
  language_preference       TEXT        NOT NULL DEFAULT 'gu'
                                          CHECK (language_preference IN ('gu', 'hi', 'en')),
  timezone                  TEXT        NOT NULL DEFAULT 'Asia/Kolkata',
  onboarded_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_organizations_billing_status ON organizations(billing_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_tier ON organizations(tier) WHERE deleted_at IS NULL;
