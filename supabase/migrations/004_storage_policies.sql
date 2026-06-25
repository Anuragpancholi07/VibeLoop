-- Storage Policies for Event Banners inside 'user-uploads' bucket

-- 1. INSERT: Allow authenticated users to upload files to 'events/owner_id/*' folder
CREATE POLICY "Allow auth users to upload event banners 271e3c4"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'events' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 2. SELECT: Allow public read access to event banners
CREATE POLICY "Allow public read on event banners 271e3c4"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'events'
);

-- 3. UPDATE: Allow users to update their own event banners
CREATE POLICY "Allow users to update own event banners 271e3c4"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'events' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. DELETE: Allow users to delete their own event banners
CREATE POLICY "Allow users to delete own event banners 271e3c4"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'events' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
