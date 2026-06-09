-- Helper functions called by the API layer to generate sequential document numbers.
-- Format: ORD-YYMM-NNN (e.g. ORD-2606-001). Padded to 3 digits; rolls over per-month visually
-- but the underlying sequence is global and never resets, so numbers stay unique forever.

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT format('ORD-%s-%s', to_char(now(), 'YYMM'), lpad(nextval('order_number_seq')::text, 3, '0'));
$$;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT format('INV-%s-%s', to_char(now(), 'YYMM'), lpad(nextval('invoice_number_seq')::text, 3, '0'));
$$;

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT format('PO-%s-%s', to_char(now(), 'YYMM'), lpad(nextval('po_number_seq')::text, 3, '0'));
$$;
