-- S5 Task 2: Role-based RLS reads role/org from app_metadata.
--
-- CONTEXT: VyaOps RLS already enforces role on writes — every INSERT/UPDATE policy on
-- orders, invoices, customers, vendors, products, production_batches, etc. already calls
-- _current_role() (see 20260601100001_rls_policies.sql). The S5 change is therefore NOT to
-- add new role policies (PostgreSQL OR's permissive policies together, so layering a second
-- INSERT policy would only LOOSEN access). Instead we update the two SECURITY DEFINER helper
-- functions to read app_metadata first, falling back to user_metadata during the migration
-- window. Because every role/org-aware policy goes through these helpers, this single change
-- upgrades the whole RLS surface at once and keeps the claim path in one place.

-- ── Helper: effective role (app_metadata first, user_metadata fallback) ──
CREATE OR REPLACE FUNCTION _current_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    auth.jwt()->'app_metadata'->>'role',
    auth.jwt()->'user_metadata'->>'role'
  )::text;
$$;

-- ── Helper: effective org id (app_metadata first, user_metadata fallback) ──
CREATE OR REPLACE FUNCTION _current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    auth.jwt()->'app_metadata'->>'org_id',
    auth.jwt()->'user_metadata'->>'org_id'
  )::uuid;
$$;

-- ── org_dictionary: the only tenant policies that read the raw user_metadata claim
-- directly (instead of via the helper). Recreate them on _current_org_id() so they too
-- pick up app_metadata. Every other tenant table already uses the helper. ──
DROP POLICY IF EXISTS "select" ON org_dictionary;
DROP POLICY IF EXISTS "insert" ON org_dictionary;
DROP POLICY IF EXISTS "update" ON org_dictionary;

CREATE POLICY "select" ON org_dictionary FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "insert" ON org_dictionary FOR INSERT
  WITH CHECK (organization_id = _current_org_id());

CREATE POLICY "update" ON org_dictionary FOR UPDATE
  USING (organization_id = _current_org_id());

-- Tables whose RLS uses a `users` lookup keyed on auth.uid() (corrections, pending_orders)
-- are unaffected — they never read jwt metadata. Storage policies on the `invoices` bucket
-- already call _current_org_id(), so they inherit the app_metadata change automatically.
