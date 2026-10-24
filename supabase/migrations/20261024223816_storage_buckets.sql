-- Storage buckets + policies.
-- * Public read: CDN-friendly URLs; photos are public once listed.
-- * NO direct client uploads. The Storage API checks RLS on a test insert that it rolls back, so a rate
--   limit inside an INSERT policy never sticks. Instead the client calls public.reserve_upload() (checks
--   permission + rate limit, returns a server-generated path), and our server issues a signed upload URL
--   for exactly that path (createSignedUploadUrl, secret key, server-only). See docs/ARCHITECTURE.md §4.6.
-- * Owners can list/delete their own objects (SELECT is required for DELETE to match rows).
-- * Size and MIME limits are enforced by Storage itself on every upload, including signed ones.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-photos', 'listing-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('dealership-logos', 'dealership-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- listing-photos: {listing_id}/{uuid}.{ext}
create policy "Sellers see their listing photo files" on storage.objects
  for select to authenticated
  using (bucket_id = 'listing-photos' and private.can_manage_listing(private.try_uuid((storage.foldername(name))[1])));
create policy "Sellers delete listing photo files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and private.can_manage_listing(private.try_uuid((storage.foldername(name))[1])));

-- avatars: {user_id}/{uuid}.{ext}
create policy "Users see their avatar files" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their avatar files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- dealership-logos: {dealership_id}/{uuid}.{ext}
create policy "Dealership admins see logo files" on storage.objects
  for select to authenticated
  using (bucket_id = 'dealership-logos' and private.is_dealership_member(private.try_uuid((storage.foldername(name))[1]), 'admin'));
create policy "Dealership admins delete logo files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dealership-logos' and private.can_act_for_dealership(private.try_uuid((storage.foldername(name))[1]), 'admin'));

-- Reserve an upload slot: checks the caller may write to `p_target` (listing / own user id / dealership),
-- applies the rate limit (this is a normal committed API call, so the counter sticks), and returns the
-- object path to sign. The extension is chosen from the declared MIME type, never from the client filename.
create function public.reserve_upload(p_bucket text, p_target_id uuid, p_content_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ext text := case p_content_type
    when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_ext is null then
    raise exception 'Unsupported file type' using errcode = '22023';
  end if;

  if p_bucket = 'listing-photos' and private.can_manage_listing(p_target_id) then
    perform private.enforce_rate_limit('photo_upload');
  elsif p_bucket = 'avatars' and p_target_id = auth.uid() then
    perform private.enforce_rate_limit('profile_image_upload');
  elsif p_bucket = 'dealership-logos' and private.can_act_for_dealership(p_target_id, 'admin') then
    perform private.enforce_rate_limit('profile_image_upload');
  else
    raise exception 'Not allowed to upload here' using errcode = '42501';
  end if;

  return p_target_id::text || '/' || gen_random_uuid()::text || '.' || v_ext;
end;
$$;

revoke all on function public.reserve_upload(text, uuid, text) from public, anon;
grant execute on function public.reserve_upload(text, uuid, text) to authenticated;
