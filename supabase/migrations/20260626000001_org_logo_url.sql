-- Add logo_url column to organizations and create org-logos storage bucket.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Storage bucket for organisation logos.
-- 2 MB max; JPEG, PNG, WebP only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'org_logos_insert'
  ) THEN
    CREATE POLICY "org_logos_insert" ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'org-logos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'org_logos_update'
  ) THEN
    CREATE POLICY "org_logos_update" ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'org-logos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'org_logos_select'
  ) THEN
    CREATE POLICY "org_logos_select" ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'org-logos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'org_logos_delete'
  ) THEN
    CREATE POLICY "org_logos_delete" ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'org-logos');
  END IF;
END $$;
