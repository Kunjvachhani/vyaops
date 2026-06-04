-- Purchase orders placed with vendors/suppliers.
-- po_number format: PO-YYMM-NNN (generated via po_number_seq).
-- triggered_by_order_id: nullable FK to the customer order that prompted this PO.

CREATE TABLE vendor_orders (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  po_number              TEXT         NOT NULL,
  vendor_id              UUID         NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  material_name          TEXT         NOT NULL,
  quantity               NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit                   TEXT         NOT NULL DEFAULT 'tons',
  unit_price_paise       BIGINT       CHECK (unit_price_paise >= 0),
  total_amount_paise     BIGINT       CHECK (total_amount_paise >= 0),
  status                 TEXT         NOT NULL DEFAULT 'draft'
                                        CHECK (status IN ('draft', 'sent', 'acknowledged', 'in_transit', 'received', 'partially_received', 'cancelled')),
  expected_date          DATE,
  received_quantity      NUMERIC(10,2) NOT NULL DEFAULT 0,
  received_date          DATE,
  triggered_by_order_id  UUID         REFERENCES orders(id) ON DELETE SET NULL,
  quality_status         TEXT         NOT NULL DEFAULT 'pending'
                                        CHECK (quality_status IN ('pending', 'approved', 'rejected')),
  notes                  TEXT,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON vendor_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_vendor_orders_org ON vendor_orders(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_orders_vendor ON vendor_orders(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendor_orders_po_number ON vendor_orders(organization_id, po_number) WHERE deleted_at IS NULL;
