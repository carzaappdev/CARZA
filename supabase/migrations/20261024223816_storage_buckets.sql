-- Storage buckets + policies. Public read (CDN-friendly, photos are public once listed); writes are scoped
-- by path: the first folder is the listing / user / dealership id, and the policy checks ownership of it.
-- Size and MIME limits are enforced by Storage itself (server-side), and again in Zod before upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-photos', 'listing-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('dealership-logos', 'dealership-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- listing-photos: {listing_id}/{uuid}.{ext}
create policy "Sellers upload listing photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and private.can_manage_listing(private.try_uuid((storage.foldername(name))[1])));
create policy "Sellers replace listing photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos' and private.can_manage_listing(private.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'listing-photos' and private.can_manage_listing(private.try_uuid((storage.foldername(name))[1])));
create policy "Sellers delete listing photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and private.can_manage_listing(private.try_uuid((storage.foldername(name))[1])));

-- avatars: {user_id}/{uuid}.{ext}
create policy "Users upload their avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users replace their avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- dealership-logos: {dealership_id}/{uuid}.{ext}
create policy "Dealership admins upload logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dealership-logos' and private.is_dealership_member(private.try_uuid((storage.foldername(name))[1]), 'admin'));
create policy "Dealership admins replace logos" on storage.objects
  for update to authenticated
  using (bucket_id = 'dealership-logos' and private.is_dealership_member(private.try_uuid((storage.foldername(name))[1]), 'admin'))
  with check (bucket_id = 'dealership-logos' and private.is_dealership_member(private.try_uuid((storage.foldername(name))[1]), 'admin'));
create policy "Dealership admins delete logos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dealership-logos' and private.is_dealership_member(private.try_uuid((storage.foldername(name))[1]), 'admin'));

-- No select policies: public buckets serve files by URL without one, and listing bucket contents via the
-- API is not needed (we always know paths from our own tables).
