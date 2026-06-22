# Row-Level Security Policies — VyaOps

## Principle
Every table with organization_id gets RLS. Users ONLY access their org's data. Enforced at PostgreSQL level.

## Tenant ID + role from JWT (read from `app_metadata`)

> **SECURITY (S5):** `org_id` and `role` live in **`app_metadata`**, NOT `user_metadata`.
> `user_metadata` is self-editable by the user via `supabase.auth.updateUser()` from the
> browser — a worker could promote themselves to `owner`. `app_metadata` can only be written
> with the service-role key (`adminClient.auth.admin.updateUserById`), so users cannot
> self-modify it. During the migration window we still mirror both claims, so all JWT reads
> use a `COALESCE(app_metadata, user_metadata)` fallback. The fallback is removed once every
> active user has been re-stamped.

All policies read the tenant id + role through two `SECURITY DEFINER` helper functions so the
claim path lives in exactly one place:

```sql
-- Effective role: app_metadata first, user_metadata fallback during migration.
CREATE OR REPLACE FUNCTION _current_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    auth.jwt()->'app_metadata'->>'role',
    auth.jwt()->'user_metadata'->>'role'
  )::text;
$$;

-- Effective org id: app_metadata first, user_metadata fallback during migration.
CREATE OR REPLACE FUNCTION _current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    auth.jwt()->'app_metadata'->>'org_id',
    auth.jwt()->'user_metadata'->>'org_id'
  )::uuid;
$$;
```

## Standard Policy (every tenant table) — org AND role enforced

Write policies (INSERT/UPDATE) enforce BOTH org isolation AND role. This is the database's
last line of defense: even a hand-crafted Supabase request from a worker is rejected.

```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "[table]_select" ON [table] FOR SELECT
  USING (organization_id = _current_org_id() AND deleted_at IS NULL);

CREATE POLICY "[table]_insert" ON [table] FOR INSERT
  WITH CHECK (organization_id = _current_org_id() AND _current_role() IN ('owner', 'manager'));

CREATE POLICY "[table]_update" ON [table] FOR UPDATE
  USING (organization_id = _current_org_id() AND _current_role() IN ('owner', 'manager'));
-- NO DELETE POLICY = hard delete impossible (soft delete via UPDATE deleted_at)
```

> **Why a single set of policies, not layered ones:** PostgreSQL OR's together multiple
> permissive policies for the same command. Adding a new role-checked INSERT policy alongside
> an old org-only INSERT policy would NOT tighten anything — the permissive old one would still
> allow the write. Role enforcement therefore lives inside the one INSERT/UPDATE policy per
> table (via `_current_role()`), never as an additional layered policy.

## Role Restrictions (enforced in RLS write policies)
- **viewer**: SELECT only. No writes anywhere.
- **worker**: SELECT on most tables; INSERT/UPDATE on `production_batches` and `inventory_movements` only.
- **manager**: INSERT/UPDATE on `orders`, `invoices`, `customers`, `vendors`, `products`, production.
- **owner**: Full access including soft-delete and `payments`/`inventory_movements` amendments.
- SELECT policies are org-scoped only (every role reads within its org); role is checked on writes only.

## Dialect Dictionary Tables

### org_dictionary (RLS ENABLED — standard tenant isolation)
```sql
ALTER TABLE org_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select" ON org_dictionary FOR SELECT
  USING (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid AND deleted_at IS NULL);
CREATE POLICY "insert" ON org_dictionary FOR INSERT
  WITH CHECK (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid);
CREATE POLICY "update" ON org_dictionary FOR UPDATE
  USING (organization_id = (auth.jwt()->'user_metadata'->>'org_id')::uuid);
```

### industry_dictionary (RLS ENABLED — read-only for authenticated, write via service-role)
```sql
ALTER TABLE industry_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_all" ON industry_dictionary FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);
-- No INSERT/UPDATE/DELETE policies for authenticated users. Writes via service-role only.
```

### global_dictionary (RLS ENABLED — read-only for authenticated, write via service-role)
```sql
ALTER TABLE global_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_all" ON global_dictionary FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);
-- No INSERT/UPDATE/DELETE policies for authenticated users. Writes via service-role only.
```

## Platform Admins (cross-org maintainer plane)

### platform_admins (RLS ENABLED — NO policies → service-role only)
A separate auth plane for VyaOps platform maintainers (founders/support). NOT org-scoped:
platform admins act across all orgs for recovery and support.

```sql
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
-- No policies defined → anon/authenticated roles have zero access.
-- Only the service-role client (which bypasses RLS) can read or write it.
```

- Membership is checked server-side via `getPlatformAdmin()` (`src/lib/supabase/platform-admin.ts`),
  which queries this table with the service-role client. This DB lookup is the authoritative check.
- A fast-path `app_metadata.is_platform_admin = true` flag is stamped on the auth user when they
  are added (and removed on revoke) so edge middleware can gate the `/admin` route group without a
  DB round-trip. The `(admin)` layout still calls `getPlatformAdmin()` as the hard check (defense in depth).
- Soft-revoke via `revoked_at` (never hard-delete — preserves the audit trail).
- All platform-admin mutations write `audit_log` with `changed_by_source = 'platform_admin'`.

## Service-Role Exceptions
n8n webhooks use service_role (bypasses RLS). MUST verify signatures first.
audit_log has NO RLS — service-role writes only.
industry_dictionary and global_dictionary: RLS enabled but only SELECT policies for authenticated users. All writes via service-role (promotion logic, admin, learning module).
platform_admins: RLS enabled, NO policies — service-role only (never readable/writable by authenticated users).
