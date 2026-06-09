-- Add city, state, and credit_limit_paise to the customers table.
-- credit_limit_paise stored as integer paise (₹1 = 100 paise), consistent with all monetary columns.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS city               TEXT,
  ADD COLUMN IF NOT EXISTS state              TEXT NOT NULL DEFAULT 'Gujarat',
  ADD COLUMN IF NOT EXISTS credit_limit_paise BIGINT NOT NULL DEFAULT 0;
