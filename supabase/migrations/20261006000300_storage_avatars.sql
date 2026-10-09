-- =============================================================================
-- TripSplit · Storage: profile avatars
--
-- Public-read bucket (avatars are shown to fellow travelers). Each user may
-- only write inside their own folder: tripsplit-avatars/<user id>/<file>.
-- Bucket and policy names are prefixed so they can't collide with another app
-- sharing the project.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tripsplit-avatars', 'tripsplit-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "TripSplit avatars: read own objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'tripsplit-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "TripSplit avatars: upload to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tripsplit-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "TripSplit avatars: update own objects"
  on storage.objects for update to authenticated
  using (bucket_id = 'tripsplit-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'tripsplit-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "TripSplit avatars: delete own objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tripsplit-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
