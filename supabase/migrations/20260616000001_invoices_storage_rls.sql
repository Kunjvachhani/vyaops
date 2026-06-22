-- RLS for the private `invoices` storage bucket.
--
-- The bucket itself (private, PDF-only) is created in
-- 20260615000001_create_invoices_storage_bucket.sql. Today all reads/writes go
-- through adminClient (service role), which BYPASSES storage RLS — so these
-- policies are defense in depth: if an authenticated anon-key client ever touches
-- storage.objects directly, it is confined to its own organization's folder.
--
-- Object key convention (see src/lib/invoices/render.ts → storagePath):
--   {organization_id}/{invoice_id}-{version}.pdf
-- so the first path segment is the owning org. `_current_org_id()` reads
-- auth.jwt()->'user_metadata'->>'org_id' (defined in 20260601100001_rls_policies.sql).
--
-- Note: storage.objects ships with RLS already enabled by Supabase; we only add
-- the scoped SELECT/INSERT policies here. We intentionally do NOT add an anon-key
-- UPDATE/DELETE policy — mutations are service-role-only.

-- Re-create idempotently so re-running the migration set is safe.
DROP POLICY IF EXISTS "invoices_storage_select_own_org" ON storage.objects;
DROP POLICY IF EXISTS "invoices_storage_insert_own_org" ON storage.objects;

CREATE POLICY "invoices_storage_select_own_org"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = _current_org_id()::text
  );

CREATE POLICY "invoices_storage_insert_own_org"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = _current_org_id()::text
  );
