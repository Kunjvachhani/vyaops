-- S5 Task 1: Move org_id + role from user_metadata to app_metadata.
--
-- WHY: user_metadata is self-editable by the end user via supabase.auth.updateUser()
-- from the browser — a worker could promote themselves to 'owner'. app_metadata can
-- only be written with the service-role key, so users cannot self-modify it.
--
-- This is a DATA migration (no schema change). It copies org_id + role from each
-- existing auth user's raw_user_meta_data into raw_app_meta_data so existing sessions
-- keep working once getCurrentUser()/middleware/RLS start reading app_metadata.
--
-- We KEEP user_metadata in place during the transition (signup stamps both). A future
-- cleanup sprint can strip org_id/role out of user_metadata once every active user has
-- a fresh JWT carrying app_metadata.

UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'org_id', raw_user_meta_data->>'org_id',
       'role',   raw_user_meta_data->>'role'
     )
WHERE raw_user_meta_data->>'org_id' IS NOT NULL
  AND raw_user_meta_data->>'role'   IS NOT NULL;

-- NOTE: existing users must obtain a fresh JWT (re-login or token refresh) for the new
-- app_metadata claim to appear in their token. The user_metadata fallback in
-- getCurrentUser()/middleware/_current_role()/_current_org_id() covers them until then.
