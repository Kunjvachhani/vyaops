-- Every stock change logged for full traceability.
-- APPEND-ONLY: no updated_at, no deleted_at, no trigger. Records are never modified.
-- balance_after is a snapshot of inventory.current_quantity after this movement was applied.

CREATE TABLE inventory_movements (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  inventory_id     UUID         NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
  movement_type    TEXT         NOT NULL CHECK (movement_type IN ('addition', 'deduction', 'adjustment')),
  quantity         NUMERIC(12,2) NOT NULL,
  reason           TEXT         NOT NULL
                                  CHECK (reason IN ('production', 'vendor_receipt', 'dispatch', 'adjustment', 'return')),
  reference_type   TEXT         CHECK (reference_type IN ('production_batch', 'vendor_order', 'order')),
  reference_id     UUID,
  balance_after    NUMERIC(12,2) NOT NULL,
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_movements_inventory ON inventory_movements(inventory_id);
CREATE INDEX idx_inventory_movements_org ON inventory_movements(organization_id);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at DESC);
