-- The factory's suppliers (who they buy from).

CREATE TABLE vendors (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name               TEXT         NOT NULL,
  company_name       TEXT,
  aliases            TEXT[]       NOT NULL DEFAULT '{}',
  phone              TEXT,
  email              TEXT,
  gstin              TEXT,
  address            TEXT,
  materials_supplied TEXT[],
  payment_terms_days INTEGER      NOT NULL DEFAULT 30,
  rating             NUMERIC(2,1) NOT NULL DEFAULT 0
                                    CHECK (rating >= 0 AND rating <= 5),
  notes              TEXT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_vendors_org ON vendors(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_aliases ON vendors USING GIN(aliases);
CREATE INDEX idx_vendors_materials ON vendors USING GIN(materials_supplied);
