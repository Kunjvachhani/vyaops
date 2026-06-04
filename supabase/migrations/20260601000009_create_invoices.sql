-- Invoices generated for completed orders.
-- invoice_number format: INV-YYMM-NNN (generated via invoice_number_seq).
-- All monetary values in paise (INTEGER).
-- tax_rate stored as NUMERIC for GST percentage display; math uses integer paise columns.

CREATE TABLE invoices (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  invoice_number      TEXT         NOT NULL,
  order_id            UUID         REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id         UUID         NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  subtotal_paise      BIGINT       NOT NULL CHECK (subtotal_paise >= 0),
  tax_rate            NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  tax_amount_paise    BIGINT       NOT NULL CHECK (tax_amount_paise >= 0),
  total_amount_paise  BIGINT       NOT NULL CHECK (total_amount_paise >= 0),
  status              TEXT         NOT NULL DEFAULT 'draft'
                                     CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled')),
  due_date            DATE         NOT NULL,
  paid_amount_paise   BIGINT       NOT NULL DEFAULT 0,
  paid_date           DATE,
  payment_method      TEXT         CHECK (payment_method IN ('upi', 'bank_transfer', 'cash', 'cheque')),
  pdf_url             TEXT,
  sent_via_whatsapp   BOOLEAN      NOT NULL DEFAULT FALSE,
  sent_at             TIMESTAMPTZ,
  reminder_count      INTEGER      NOT NULL DEFAULT 0,
  last_reminder_at    TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_invoices_status ON invoices(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due ON invoices(due_date) WHERE status NOT IN ('paid', 'cancelled') AND deleted_at IS NULL;
CREATE INDEX idx_invoices_customer ON invoices(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_invoice_number ON invoices(organization_id, invoice_number) WHERE deleted_at IS NULL;
