-- The factory's product catalog.
-- raw_materials JSONB: [{material_id: UUID, qty_per_unit: number}]
-- unit_price_paise stored as BIGINT (paise, not rupees).

CREATE TABLE products (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name             TEXT        NOT NULL,
  code             TEXT,
  aliases          TEXT[]      NOT NULL DEFAULT '{}',
  category         TEXT,
  unit             TEXT        NOT NULL DEFAULT 'pieces'
                                 CHECK (unit IN ('pieces', 'tons', 'kg', 'meters', 'sq_ft', 'boxes')),
  unit_price_paise BIGINT      NOT NULL DEFAULT 0,
  hsn_code         TEXT,
  raw_materials    JSONB       NOT NULL DEFAULT '[]',
  reorder_level    INTEGER     NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_products_org ON products(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_aliases ON products USING GIN(aliases);
CREATE UNIQUE INDEX idx_products_code_org ON products(organization_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL;
