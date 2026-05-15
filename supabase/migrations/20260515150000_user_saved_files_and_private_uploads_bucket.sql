-- טבלת קבצים שמורים למשתמשים מחוברים + bucket Storage פרטי (ללא הגבלת סוג קובץ — כולל ZIP)

CREATE TABLE public.user_saved_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  bucket_id text NOT NULL DEFAULT 'user-uploads',
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  content_type text,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_saved_files_bucket_path_unique UNIQUE (user_id, bucket_id, storage_path),
  CONSTRAINT user_saved_files_bucket_fk CHECK (bucket_id = 'user-uploads')
);

COMMENT ON TABLE public.user_saved_files IS
  'מטא-דאטה לקבצים שהמשתמש העלה ל-Storage; נתיב האחסון תחת תיקייה בשם user_id. כל סוגי הקבצים מותרים (כולל ZIP).';

CREATE INDEX user_saved_files_user_created_idx
  ON public.user_saved_files (user_id, created_at DESC);

ALTER TABLE public.user_saved_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_saved_files_select_own
  ON public.user_saved_files
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_saved_files_insert_own
  ON public.user_saved_files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_saved_files_update_own
  ON public.user_saved_files
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_saved_files_delete_own
  ON public.user_saved_files
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.user_saved_files_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_saved_files_updated_at ON public.user_saved_files;
CREATE TRIGGER user_saved_files_updated_at
  BEFORE UPDATE ON public.user_saved_files
  FOR EACH ROW
  EXECUTE FUNCTION public.user_saved_files_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_files TO authenticated;
GRANT ALL ON public.user_saved_files TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  false,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- מדיניות Storage: כל אובייקט חייב להיות תחת {auth.uid()}/...
CREATE POLICY user_uploads_objects_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY user_uploads_objects_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY user_uploads_objects_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY user_uploads_objects_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
