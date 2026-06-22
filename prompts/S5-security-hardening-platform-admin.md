# S5: Security Hardening + Platform Admin Panel

Read these docs first (in order):
1. `docs/security/RLS_POLICIES.md`
2. `docs/security/EDGE_CASES.md`
3. `docs/database/SCHEMA.md`
4. `src/lib/supabase/server.ts` — `getCurrentUser()` and `AuthUser` type
5. `src/lib/supabase/admin.ts` — service-role client
6. `src/middleware.ts` — route-level auth
7. `src/app/(auth)/signup/actions.ts` — where `user_metadata` is stamped
8. `src/app/api/admin/deleted/route.ts` — existing org-scoped recovery (owner only)
9. `src/app/api/admin/restore/route.ts` — existing org-scoped restore (owner/manager)
10. `src/lib/utils/audit.ts` — audit logging
11. `src/lib/utils/soft-delete.ts` — soft-delete/restore helpers

This sprint has 3 tasks. Do them sequentially — each builds on the previous.

---

## Task 1: Move `org_id` + `role` from `user_metadata` to `app_metadata`

### The problem
`user_metadata` can be updated by the user themselves via `supabase.auth.updateUser()` from the browser. A worker could open the browser console and promote themselves to owner. `app_metadata` requires service-role to update — users cannot self-modify it.

### What to change

**Migration (next sequence number after `20260621000002`):**
- No schema changes needed — this is a Supabase Auth change, not a table change.
- BUT: write a migration that updates ALL existing auth users to copy their `user_metadata.org_id` and `user_metadata.role` into `app_metadata` using `auth.users` direct update. This is a data migration so existing users aren't broken.
- SQL should look like:
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data
  || jsonb_build_object('org_id', raw_user_meta_data->>'org_id', 'role', raw_user_meta_data->>'role')
WHERE raw_user_meta_data->>'org_id' IS NOT NULL;
```

**`src/app/(auth)/signup/actions.ts`:**
- Line 83-84: Change `user_metadata` to `app_metadata` in the `adminClient.auth.admin.updateUserById()` call.
- Keep BOTH `user_metadata` AND `app_metadata` during transition (so the JWT carries both). `user_metadata` can be removed in a future cleanup sprint.
- The call should become:
```ts
const { error: metaError } = await adminClient.auth.admin.updateUserById(authUserId, {
  app_metadata: { org_id: orgId, role },
  user_metadata: { org_id: orgId, role }, // keep for backward compat during transition
})
```

**`src/lib/supabase/server.ts` — `getCurrentUser()`:**
- Change line 43 to read from `app_metadata` instead of `user_metadata`:
```ts
const meta = user.app_metadata as Record<string, string> | undefined
```
- Keep a fallback to `user_metadata` for any users who haven't been migrated yet:
```ts
const meta = (user.app_metadata?.org_id ? user.app_metadata : user.user_metadata) as Record<string, string> | undefined
```

**`src/middleware.ts`:**
- Line 40: Same change — read `app_metadata` with `user_metadata` fallback:
```ts
const appMeta = user?.app_metadata as Record<string, unknown> | undefined
const userMeta = user?.user_metadata as Record<string, unknown> | undefined
const meta = appMeta?.org_id ? appMeta : userMeta
```

**Any future user-invite flow** (not built yet, but note for later): when an owner invites a new user to their org, the invite action MUST use `adminClient.auth.admin.updateUserById()` to stamp `app_metadata` — never let the invited user set their own role.

### Verification
- After this change, open browser console on a logged-in session and try:
  ```js
  const { error } = await supabase.auth.updateUser({ data: { role: 'owner' } })
  ```
  This should still succeed (it updates `user_metadata`), but `getCurrentUser()` should ignore it because it now reads `app_metadata`.

---

## Task 2: Add Role-Based RLS Policies for Write Operations

### The problem
Current RLS only checks `organization_id` — it doesn't check the user's `role`. A worker who crafts a direct Supabase request could INSERT into `orders` or `invoices` even though the application blocks it. The database should be the last line of defense.

### What to change

**Migration:**

Create role-checking RLS policies on these critical tables: `orders`, `invoices`, `customers`, `vendors`, `products`.

The role is now in `app_metadata` (from Task 1). The JWT claim path is:
```sql
(auth.jwt() -> 'app_metadata' ->> 'role')
```

With a fallback to `user_metadata` during migration:
```sql
COALESCE(
  auth.jwt() -> 'app_metadata' ->> 'role',
  auth.jwt() -> 'user_metadata' ->> 'role'
)
```

**New policies to ADD (don't remove existing ones — layer these on top):**

```sql
-- Helper function to get the effective role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Orders: only owner + manager can INSERT/UPDATE
CREATE POLICY "insert_role_check" ON orders FOR INSERT
  WITH CHECK (
    organization_id = (COALESCE(auth.jwt()->'app_metadata', auth.jwt()->'user_metadata')->>'org_id')::uuid
    AND public.get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "update_role_check" ON orders FOR UPDATE
  USING (
    organization_id = (COALESCE(auth.jwt()->'app_metadata', auth.jwt()->'user_metadata')->>'org_id')::uuid
    AND public.get_user_role() IN ('owner', 'manager')
  );
```

Apply the same pattern to: `invoices`, `customers`, `vendors`, `products`.

**For `production_batches`:** workers CAN insert, so the policy is:
```sql
CREATE POLICY "insert_role_check" ON production_batches FOR INSERT
  WITH CHECK (
    organization_id = (COALESCE(auth.jwt()->'app_metadata', auth.jwt()->'user_metadata')->>'org_id')::uuid
    AND public.get_user_role() IN ('owner', 'manager', 'worker')
  );
```

**IMPORTANT:** The existing SELECT/INSERT/UPDATE policies that only check `organization_id` need to be DROPped and replaced with the new ones that check BOTH `organization_id` AND `role`. You can't just add new INSERT policies alongside old INSERT policies — PostgreSQL OR's them together, which would defeat the purpose (the old permissive policy would still allow the insert).

**Do NOT add role checks to SELECT policies** — all roles can read within their org. Keep SELECT as org-scoped only.

### Verification
- After applying, connect as a worker user and try to INSERT into `orders` via the Supabase client — it should fail with an RLS violation.
- Verify that a manager can still INSERT into `orders`.
- Verify that a worker can still INSERT into `production_batches`.

---

## Task 3: Platform Admin System (Option A — Allowlist Table)

### The goal
A completely separate auth plane for VyaOps platform maintainers. Not org-scoped — platform admins can see and act across all orgs. The `(admin)` route group gets a proper gate. Cross-org recovery becomes possible.

### 3A: Migration — `platform_admins` table

```sql
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT '',          -- human-readable note: "Kunj — founder"
  added_by   UUID REFERENCES auth.users(id),    -- NULL for the seed row
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,                       -- soft-revoke (don't delete, audit trail)

  CONSTRAINT unique_platform_admin UNIQUE (user_id)
);

-- RLS DISABLED — this table is service-role-only.
-- Authenticated users must never read or write it.
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated roles.
-- Service-role bypasses RLS.

-- Seed: insert your own auth.users.id
-- You'll need to look this up: SELECT id FROM auth.users WHERE email = '1kunjvachhani@gmail.com';
-- INSERT INTO platform_admins (user_id, label) VALUES ('<your-auth-user-id>', 'Kunj — founder');
```

Add a comment in the migration noting that the seed INSERT must be run manually after the first signup, or provide it as a separate seed step.

### 3B: Server helper — `src/lib/supabase/platform-admin.ts`

```ts
import { adminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'

export type PlatformAdmin = {
  id: string           // platform_admins.id
  user_id: string      // auth.users.id
  label: string
}

/**
 * Check if the current session user is a platform admin.
 * Returns the PlatformAdmin row if yes, null if no.
 * Uses adminClient (service-role) because the table has no RLS policies for authenticated users.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await adminClient
    .from('platform_admins')
    .select('id, user_id, label')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle()

  if (error) {
    console.error('[platform-admin] lookup failed:', error)
    return null
  }

  return data as PlatformAdmin | null
}
```

### 3C: Middleware gate on `(admin)` route group

Update `src/middleware.ts`:
- The current matcher excludes `/api` routes. That's fine — API routes do their own auth.
- Add a check: if `pathname.startsWith('/admin')`, call a lightweight platform admin check.

**Problem:** middleware can't easily call `adminClient` (it needs service-role which shouldn't be in edge middleware). Instead, stamp `is_platform_admin: true` into `app_metadata` when adding someone to `platform_admins`. Then middleware just checks:
```ts
if (pathname.startsWith('/admin')) {
  const isPlatformAdmin = meta?.is_platform_admin === true
  if (!isPlatformAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
}
```

The `getPlatformAdmin()` helper is still used in API routes and server components as the authoritative check (defense in depth — the `app_metadata` flag is the fast path, the DB lookup is the hard check).

When adding a user to `platform_admins`, also stamp their `app_metadata`:
```ts
await adminClient.auth.admin.updateUserById(userId, {
  app_metadata: { ...existingAppMeta, is_platform_admin: true }
})
```

When revoking, remove the flag.

### 3D: Build the `(admin)` route group — pages

Create `src/app/(admin)/layout.tsx`:
- Server component that calls `getPlatformAdmin()`.
- If null, redirect to `/dashboard`.
- Render a minimal admin shell (different from the tenant dashboard — make it visually distinct so you never confuse which mode you're in).

Create `src/app/(admin)/admin/page.tsx` (the admin home):
- Show: total orgs, total users, recent audit log entries (last 50).
- Link to the deleted records recovery page.

Create `src/app/(admin)/admin/recovery/page.tsx`:
- A table selector (dropdown of all soft-deletable tables from `SOFT_DELETABLE_TABLES`).
- An org selector (dropdown of all orgs from `organizations` table).
- Lists deleted records for the selected org+table.
- "Restore" button per record.
- Every action writes audit_log with a new source: `'platform_admin'`.

### 3E: Widen the existing admin API routes

**`src/app/api/admin/deleted/route.ts`:**
- Currently org-scoped to `user.org_id` and owner-only.
- Add a branch: if `getPlatformAdmin()` returns non-null, allow passing `?org_id=<uuid>` to query any org's deleted records. Skip the owner role check for platform admins.
- If no `org_id` param and the caller is a platform admin, return an error asking them to specify an org (don't default to their personal org — platform admins might not even have one).

**`src/app/api/admin/restore/route.ts`:**
- Same pattern: platform admins can restore records in any org by passing `org_id` in the body.
- Audit log entry must include `changed_by_source: 'platform_admin'`.

### 3F: Update audit types

In `src/lib/utils/audit.ts`:
- Add `'platform_admin'` to the `AuditSource` type.
- Add `'platform_admin'` to the `AuditEntityType` if needed for tracking admin table changes.

### Verification
- Log in as your seed admin user → navigate to `/admin` → should load.
- Log in as a regular org owner → navigate to `/admin` → should redirect to `/dashboard`.
- From the admin recovery page, select an org and table → should show deleted records across that org.
- Restore a record → verify audit_log has `changed_by_source = 'platform_admin'`.
- Verify the regular org-scoped `/api/admin/deleted` and `/api/admin/restore` still work for org owners (no regression).

---

## Files touched (summary)

**New files:**
- `supabase/migrations/20260622000001_move_auth_to_app_metadata.sql`
- `supabase/migrations/20260622000002_role_based_rls.sql`
- `supabase/migrations/20260622000003_create_platform_admins.sql`
- `src/lib/supabase/platform-admin.ts`
- `src/app/(admin)/layout.tsx`
- `src/app/(admin)/admin/page.tsx`
- `src/app/(admin)/admin/recovery/page.tsx`

**Modified files:**
- `src/app/(auth)/signup/actions.ts` — `app_metadata` instead of `user_metadata`
- `src/lib/supabase/server.ts` — `getCurrentUser()` reads `app_metadata`
- `src/middleware.ts` — `app_metadata` + `/admin` gate
- `src/app/api/admin/deleted/route.ts` — platform admin cross-org branch
- `src/app/api/admin/restore/route.ts` — platform admin cross-org branch
- `src/lib/utils/audit.ts` — add `platform_admin` source
- `src/types/database.ts` — regenerate after migrations

**Docs to update:**
- `docs/security/RLS_POLICIES.md` — document the new role-based policies
- `docs/security/EDGE_CASES.md` — document platform admin recovery flow
- `CLAUDE.md` — add platform admin to the security rules section

---

## Constraints reminder
- TypeScript strict mode, no `any`, no `@ts-ignore`.
- All audit actions logged. Platform admin actions use source `'platform_admin'`.
- `platform_admins` table: RLS enabled but NO policies (service-role only access).
- Never expose `service_role` key to the client.
- The `(admin)` layout must call `getPlatformAdmin()` (DB check), not just trust `app_metadata` alone.
- Every new i18n string goes in `en.json`, `hi.json`, `gu.json`.
