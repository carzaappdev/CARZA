-- Reels: short vertical car videos. Free tier: videos are stored as uploaded in Supabase Storage (no
-- transcoding), so the client enforces MP4/MOV/WebM, <= 60s and <= 50 MB, and uploads a poster frame
-- for instant display. Bucket limits below are the hard backstop.

-- ---------------------------------------------------------------------------
-- Rate limits: adds reel_upload, reel_create and reel_like.
-- ---------------------------------------------------------------------------
create or replace function private.enforce_rate_limit(p_bucket text, p_subject uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject uuid := coalesce(p_subject, auth.uid());
  v_limit record;
  v_window_start timestamptz;
  v_count integer;
begin
  -- Limits apply to API callers, identified by the role PostgREST/Storage switched to (`anon` or
  -- `authenticated`). The `role` setting is unaffected by SECURITY DEFINER, unlike current_user.
  -- Direct SQL (migrations, seed, SQL editor) and the service role are trusted and skip.
  if coalesce(current_setting('role', true), 'none') not in ('anon', 'authenticated') then
    return;
  end if;
  if v_subject is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Allow-list of buckets: (bucket, max events, window seconds). A bucket can have several windows.
  for v_limit in
    select l.max_count, l.window_seconds
    from (values
      ('message_send', 30, 60),
      ('message_send', 300, 86400),
      ('conversation_start', 10, 3600),
      ('conversation_start', 30, 86400),
      ('listing_create', 10, 86400),
      -- Keyed per dealership (not per staff member), so adding staff doesn't multiply it.
      ('dealer_listing_create', 2000, 86400),
      ('photo_upload', 200, 3600),
      ('photo_upload', 1000, 86400),
      ('profile_image_upload', 20, 3600),
      ('test_drive_request', 5, 3600),
      ('test_drive_request', 10, 86400),
      ('report_create', 20, 86400),
      ('dealer_apply', 3, 86400),
      ('invite_send', 50, 86400),
      ('post_create', 30, 3600),
      ('post_create', 200, 86400),
      ('post_like', 300, 3600),
      ('follow', 100, 3600),
      ('follow', 500, 86400),
      ('event_create', 5, 86400),
      ('event_create', 20, 604800),
      ('event_rsvp', 60, 3600),
      ('reel_upload', 10, 3600),
      ('reel_upload', 30, 86400),
      ('reel_create', 10, 3600),
      ('reel_create', 30, 86400),
      ('reel_like', 300, 3600)
    ) as l(bucket, max_count, window_seconds)
    where l.bucket = p_bucket
  loop
    v_window_start := to_timestamp(floor(extract(epoch from now()) / v_limit.window_seconds) * v_limit.window_seconds);

    insert into private.rate_limits as r (key, window_start)
    values (p_bucket || ':' || v_limit.window_seconds || ':' || v_subject, v_window_start)
    on conflict (key, window_start) do update set count = r.count + 1
    returning r.count into v_count;

    if v_count > v_limit.max_count then
      raise exception 'Rate limit exceeded for %', p_bucket using errcode = 'CZ429';
    end if;
  end loop;

  if not found then
    raise exception 'Unknown rate limit bucket %', p_bucket;
  end if;

  -- Opportunistic cleanup of expired windows (~1% of calls).
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '2 days';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- Storage: reels/{user_id}/{uuid}.{mp4|mov|webm} and poster images alongside.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('reels', 'reels', true, 52428800,
   array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users see their reel files" on storage.objects
  for select to authenticated
  using (bucket_id = 'reels' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their reel files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reels' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.reserve_upload(p_bucket text, p_target_id uuid, p_content_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ext text := case p_content_type
    when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp'
    when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' when 'video/webm' then 'webm' end;
  v_video boolean := p_content_type like 'video/%';
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_ext is null then
    raise exception 'Unsupported file type' using errcode = '22023';
  end if;

  -- Videos only ever go to the reels bucket; posters for reels are images in the same bucket.
  if v_video and p_bucket <> 'reels' then
    raise exception 'Unsupported file type' using errcode = '22023';
  end if;

  if p_bucket = 'reels' and p_target_id = auth.uid() then
    perform private.enforce_rate_limit(case when v_video then 'reel_upload' else 'photo_upload' end);
  elsif p_bucket = 'listing-photos' and private.can_manage_listing(p_target_id) then
    perform private.enforce_rate_limit('photo_upload');
  elsif p_bucket = 'post-photos' and p_target_id = auth.uid() then
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


-- ---------------------------------------------------------------------------
-- reels
-- ---------------------------------------------------------------------------
create table public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  video_path text not null,
  poster_path text not null,
  width integer not null check (width between 1 and 8192),
  height integer not null check (height between 1 and 8192),
  duration_seconds numeric(5, 2) not null check (duration_seconds > 0 and duration_seconds <= 61),
  caption text not null default '' check (char_length(caption) <= 300),
  like_count integer not null default 0 check (like_count >= 0),
  created_at timestamptz not null default now(),
  constraint reels_video_in_author_folder check (
    video_path ~ ('^' || author_id::text || '/[0-9a-f-]{36}\.(mp4|mov|webm)$')
  ),
  constraint reels_poster_in_author_folder check (
    poster_path ~ ('^' || author_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
  )
);

create index reels_feed_idx on public.reels (created_at desc, id desc);
create index reels_author_idx on public.reels (author_id, created_at desc);

alter table public.reels enable row level security;

revoke all on public.reels from anon, authenticated;
grant select on public.reels to anon, authenticated;
grant insert (video_path, poster_path, width, height, duration_seconds, caption) on public.reels to authenticated;
grant delete on public.reels to authenticated;

create policy "Reels are public" on public.reels
  for select to anon, authenticated using (true);
create policy "Users post reels as themselves" on public.reels
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors and admins delete reels" on public.reels
  for delete to authenticated using (author_id = (select auth.uid()) or private.is_admin());

create function private.reels_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('reel_create');
  return new;
end;
$$;

revoke all on function private.reels_before_insert() from public, anon, authenticated;

create trigger reels_before_insert before insert on public.reels
  for each row execute function private.reels_before_insert();

-- ---------------------------------------------------------------------------
-- reel_likes
-- ---------------------------------------------------------------------------
create table public.reel_likes (
  reel_id uuid not null references public.reels (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

create index reel_likes_user_idx on public.reel_likes (user_id, created_at desc);

alter table public.reel_likes enable row level security;

revoke all on public.reel_likes from anon, authenticated;
grant select on public.reel_likes to anon, authenticated;
grant insert (reel_id) on public.reel_likes to authenticated;
grant delete on public.reel_likes to authenticated;

create policy "Reel likes are public" on public.reel_likes
  for select to anon, authenticated using (true);
create policy "Users like reels as themselves" on public.reel_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users unlike their own reel likes" on public.reel_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create function private.reel_likes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('reel_like');
  return new;
end;
$$;

create function private.reel_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.reels set like_count = like_count + 1 where id = new.reel_id;
  else
    update public.reels set like_count = greatest(like_count - 1, 0) where id = old.reel_id;
  end if;
  return null;
end;
$$;

revoke all on function private.reel_likes_before_insert(), private.reel_likes_count() from public, anon, authenticated;

create trigger reel_likes_before_insert before insert on public.reel_likes
  for each row execute function private.reel_likes_before_insert();
create trigger reel_likes_count after insert or delete on public.reel_likes
  for each row execute function private.reel_likes_count();
