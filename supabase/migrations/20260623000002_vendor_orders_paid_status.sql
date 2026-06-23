-- Allow 'paid' as a valid status for vendor_orders (purchase orders).
-- The original CHECK constraint omitted it; this migration replaces it.

ALTER TABLE vendor_orders
  DROP CONSTRAINT vendor_orders_status_check,
  ADD CONSTRAINT vendor_orders_status_check
    CHECK (status IN (
      'draft',
      'sent',
      'acknowledged',
      'in_transit',
      'received',
      'partially_received',
      'cancelled',
      'paid'
    ));
