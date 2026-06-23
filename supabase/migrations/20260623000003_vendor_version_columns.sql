-- Add integer version columns to vendors and vendor_orders for safe optimistic locking.
--
-- Why integer instead of updated_at:
-- Two concurrent requests within the same millisecond share the same timestamp.
-- An integer sequence can never tie — the DB increments it atomically on every UPDATE,
-- so only one of the two concurrent PATCHes will see its .eq('version', n) match.

ALTER TABLE vendors      ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE vendor_orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Single trigger function reused by both tables.
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_increment_version
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER vendor_orders_increment_version
  BEFORE UPDATE ON vendor_orders
  FOR EACH ROW EXECUTE FUNCTION increment_version();
