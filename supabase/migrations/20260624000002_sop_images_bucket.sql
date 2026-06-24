-- Create public storage bucket for SOP document images.
-- 5 MB per file limit; web image formats only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sop-images',
  'sop-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Any authenticated user may upload.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'sop_images_insert'
  ) THEN
    CREATE POLICY "sop_images_insert" ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'sop-images');
  END IF;
END $$;

-- Public read (bucket is public, but policy is required for anon reads via RLS).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'sop_images_select'
  ) THEN
    CREATE POLICY "sop_images_select" ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'sop-images');
  END IF;
END $$;

-- Authenticated users may delete images (e.g. clean up on SOP delete).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'sop_images_delete'
  ) THEN
    CREATE POLICY "sop_images_delete" ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'sop-images');
  END IF;
END $$;
