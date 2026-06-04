-- Current stock levels for raw materials and finished goods.
-- Unique constraint prevents duplicate items per org (partial index excludes soft-deleted rows).
-- product_id nullable: only used for finished_good rows linking back to the product catalog.

CREATE TABLE inventory (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  item_type             TEXT         NOT NULL CHECK (item_type IN ('raw_material', 'finished_good')),
  item_name             TEXT         NOT NULL,
  product_id            UUID         REFERENCES products(id) ON DELETE SET NULL,
  current_quantity      NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit                  TEXT         NOT NULL,
  reorder_level         NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_daily_consumption NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_restocked_at     TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Prevents duplicate (org, type, name) combos; ignores soft-deleted rows.
CREATE UNIQUE INDEX idx_inventory_unique_item
  ON inventory(organization_id, item_type, item_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_org ON inventory(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_product ON inventory(product_id) WHERE product_id IS NOT NULL AND deleted_at IS NULL;
