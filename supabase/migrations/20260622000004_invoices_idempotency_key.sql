-- Add idempotency_key to invoices for X-Idempotency-Key header retry resilience.
-- Mirrors the same column on the orders table.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
