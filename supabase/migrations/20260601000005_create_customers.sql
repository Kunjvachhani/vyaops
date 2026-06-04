-- The factory's customers (who they sell to).
-- aliases GIN-indexed for fast fuzzy/array matching via WhatsApp name recognition.

CREATE TABLE customers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name               TEXT        NOT NULL,
  company_name       TEXT,
  aliases            TEXT[]      NOT NULL DEFAULT '{}',
  phone              TEXT,
  email              TEXT,
  gstin              TEXT,
  address            TEXT,
  payment_terms_days INTEGER     NOT NULL DEFAULT 30,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_customers_aliases ON customers USING GIN(aliases);
CREATE INDEX idx_customers_org ON customers(organization_id) WHERE deleted_at IS NULL;
