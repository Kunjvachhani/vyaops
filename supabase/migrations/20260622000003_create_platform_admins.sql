-- S5 Task 3A: platform_admins — VyaOps platform-maintainer auth plane.
--
-- A separate, cross-org plane: platform admins are NOT tenant users and are NOT org-scoped.
-- They power the (admin) panel and cross-org recovery. This is a system_* style table:
-- no organization_id, no updated_at/deleted_at (revocation is via revoked_at).

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT '',          -- human note, e.g. "Kunj — founder"
  added_by   UUID REFERENCES auth.users(id),    -- NULL for the seed row
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,                        -- soft-revoke (preserve audit trail)

  CONSTRAINT unique_platform_admin UNIQUE (user_id)
);

-- Fast lookup of active admins.
CREATE INDEX IF NOT EXISTS idx_platform_admins_active
  ON public.platform_admins (user_id) WHERE revoked_at IS NULL;

-- RLS ENABLED with NO policies → anon/authenticated roles have ZERO access.
-- Only the service-role client (which bypasses RLS) can read or write this table.
-- getPlatformAdmin() (src/lib/supabase/platform-admin.ts) uses the service-role client.
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- SEED (run MANUALLY after the first signup — cannot be auto-seeded because the
-- founder's auth.users row only exists after they sign up):
--
--   1. Find the auth user id:
--        SELECT id FROM auth.users WHERE email = '1kunjvachhani@gmail.com';
--   2. Insert the admin row:
--        INSERT INTO public.platform_admins (user_id, label)
--        VALUES ('<auth-user-id>', 'Kunj — founder');
--   3. Stamp the fast-path flag so middleware gates /admin without a DB round-trip:
--        UPDATE auth.users
--        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
--                                || jsonb_build_object('is_platform_admin', true)
--        WHERE id = '<auth-user-id>';
--   4. The admin must re-login (or refresh their token) for the flag to enter their JWT.
-- ──────────────────────────────────────────────────────────────────────────
