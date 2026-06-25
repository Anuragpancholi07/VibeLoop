-- Migration 006: Storage policies for user avatars inside 'user-uploads' bucket

-- 1. INSERT: Allow authenticated users to upload files to 'avatars/user_id/*' folder
DROP POLICY IF EXISTS "Allow auth users to upload avatars" ON storage.objects;
CREATE POLICY "Allow auth users to upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 2. SELECT: Allow public read access to user avatars
DROP POLICY IF EXISTS "Allow public read on avatars" ON storage.objects;
CREATE POLICY "Allow public read on avatars"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- 3. UPDATE: Allow users to update their own avatars
DROP POLICY IF EXISTS "Allow users to update own avatars" ON storage.objects;
CREATE POLICY "Allow users to update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. DELETE: Allow users to delete their own avatars
DROP POLICY IF EXISTS "Allow users to delete own avatars" ON storage.objects;
CREATE POLICY "Allow users to delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
