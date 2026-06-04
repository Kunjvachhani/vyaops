-- Customer orders received by the factory.
-- order_number format: ORD-YYMM-NNN (generated via order_number_seq).
-- idempotency_key prevents duplicate order creation from WhatsApp re-deliveries.
-- All monetary values in paise (INTEGER).

CREATE TABLE orders (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  order_number        TEXT        NOT NULL,
  customer_id         UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  product_id          UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity            INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price_paise    BIGINT      NOT NULL CHECK (unit_price_paise >= 0),
  total_amount_paise  BIGINT      NOT NULL CHECK (total_amount_paise >= 0),
  status              TEXT        NOT NULL DEFAULT 'confirmed'
                                    CHECK (status IN ('draft', 'confirmed', 'in_production', 'completed', 'dispatched', 'cancelled')),
  delivery_date       DATE,
  quantity_produced   INTEGER     NOT NULL DEFAULT 0,
  quantity_dispatched INTEGER     NOT NULL DEFAULT 0,
  source              TEXT        NOT NULL DEFAULT 'whatsapp'
                                    CHECK (source IN ('whatsapp', 'web', 'manual')),
  source_message_id   TEXT,
  idempotency_key     TEXT        UNIQUE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_orders_status ON orders(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_customer ON orders(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_order_number ON orders(organization_id, order_number) WHERE deleted_at IS NULL;
