-- Payment records against invoices.
-- Partial payments supported (multiple rows per invoice).

CREATE TABLE payments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  invoice_id       UUID        NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount_paise     BIGINT      NOT NULL CHECK (amount_paise > 0),
  payment_date     DATE        NOT NULL,
  payment_method   TEXT        NOT NULL
                                 CHECK (payment_method IN ('upi', 'bank_transfer', 'cash', 'cheque')),
  reference_number TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_payments_invoice ON payments(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_org ON payments(organization_id) WHERE deleted_at IS NULL;
