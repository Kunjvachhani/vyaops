-- Sequence generators for human-readable document numbers.
-- Format: ORD-YYMM-NNN, INV-YYMM-NNN, PO-YYMM-NNN
-- Sequences are per-database (not per-org). Use counter column on organizations for org-scoped sequences.

CREATE SEQUENCE IF NOT EXISTS order_number_seq;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;
CREATE SEQUENCE IF NOT EXISTS po_number_seq;
