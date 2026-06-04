-- Daily production logging from the shop floor.
-- order_id nullable: supports stock production (no customer order).
-- On insert, triggers in application layer update orders.quantity_produced and inventory.

CREATE TABLE production_batches (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  batch_number      TEXT        NOT NULL,
  order_id          UUID        REFERENCES orders(id) ON DELETE SET NULL,
  product_id        UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_produced INTEGER     NOT NULL CHECK (quantity_produced >= 0),
  quantity_rejected INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
  defect_type       TEXT,
  shift             TEXT        CHECK (shift IN ('shift_1', 'shift_2', 'shift_3')),
  logged_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
  source            TEXT        NOT NULL DEFAULT 'whatsapp'
                                  CHECK (source IN ('whatsapp', 'web', 'manual')),
  source_message_id TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_production_batches_org ON production_batches(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_batches_order ON production_batches(order_id) WHERE order_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_production_batches_product ON production_batches(product_id) WHERE deleted_at IS NULL;
