-- Social feed: posts (a reply is a post with reply_to_id), likes and follows. Threads-style.
-- Same conventions as the rest of the schema: RLS on, explicit grants, ids and counters never set by the
-- client, rate limits enforced in the database.

-- ---------------------------------------------------------------------------
-- Rate limits: adds post_create, post_like and follow buckets (photos reuse photo_upload).
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
      ('follow', 500, 86400)
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
-- Storage: post-photos/{user_id}/{uuid}.{ext}, same upload flow as listing photos (reserve_upload).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('post-photos', 'post-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users see their post photo files" on storage.objects
  for select to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their post photo files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.reserve_upload(p_bucket text, p_target_id uuid, p_content_type text)
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
-- posts
-- ---------------------------------------------------------------------------
-- photos: up to 4 of {"path", "width", "height"}, each inside the author's own folder. Width/height let
-- the feed reserve space before the image loads.
create function private.valid_post_photos(p_author uuid, p_photos jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_photo jsonb;
begin
  if jsonb_typeof(p_photos) <> 'array' or jsonb_array_length(p_photos) > 4 then
    return false;
  end if;
  for v_photo in select * from jsonb_array_elements(p_photos) loop
    if jsonb_typeof(v_photo) <> 'object'
      or (select count(*) from jsonb_object_keys(v_photo)) <> 3
      or jsonb_typeof(v_photo -> 'path') <> 'string'
      or (v_photo ->> 'path') !~ ('^' || p_author::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
      or jsonb_typeof(v_photo -> 'width') <> 'number'
      or jsonb_typeof(v_photo -> 'height') <> 'number'
      or (v_photo ->> 'width') !~ '^[0-9]{1,5}$'
      or (v_photo ->> 'height') !~ '^[0-9]{1,5}$'
      or (v_photo ->> 'width')::int = 0
      or (v_photo ->> 'height')::int = 0
    then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reply_to_id uuid references public.posts (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 500),
  photos jsonb not null default '[]'::jsonb,
  like_count integer not null default 0 check (like_count >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  created_at timestamptz not null default now(),
  constraint posts_photos_valid check (private.valid_post_photos(author_id, photos)),
  constraint posts_not_empty check (char_length(btrim(body)) > 0 or jsonb_array_length(photos) > 0)
);

create index posts_feed_idx on public.posts (created_at desc, id desc) where reply_to_id is null;
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_replies_idx on public.posts (reply_to_id, created_at) where reply_to_id is not null;

alter table public.posts enable row level security;

revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
-- Column-level: author, counters and timestamps are never client-chosen. No editing (no update grant).
grant insert (reply_to_id, body, photos) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create policy "Posts are public" on public.posts
  for select to anon, authenticated using (true);
create policy "Users post as themselves" on public.posts
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors and admins delete posts" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()) or private.is_admin());

create function private.posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('post_create');
  return new;
end;
$$;

create function private.posts_reply_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.reply_to_id is not null then
    update public.posts set reply_count = reply_count + 1 where id = new.reply_to_id;
  elsif tg_op = 'DELETE' and old.reply_to_id is not null then
    update public.posts set reply_count = greatest(reply_count - 1, 0) where id = old.reply_to_id;
  end if;
  return null;
end;
$$;

revoke all on function private.posts_before_insert(), private.posts_reply_count() from public, anon, authenticated;

create trigger posts_before_insert before insert on public.posts
  for each row execute function private.posts_before_insert();
create trigger posts_reply_count after insert or delete on public.posts
  for each row execute function private.posts_reply_count();

-- ---------------------------------------------------------------------------
-- post_likes
-- ---------------------------------------------------------------------------
create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_idx on public.post_likes (user_id, created_at desc);

alter table public.post_likes enable row level security;

revoke all on public.post_likes from anon, authenticated;
grant select on public.post_likes to anon, authenticated;
grant insert (post_id) on public.post_likes to authenticated;
grant delete on public.post_likes to authenticated;

create policy "Likes are public" on public.post_likes
  for select to anon, authenticated using (true);
create policy "Users like as themselves" on public.post_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users unlike their own likes" on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create function private.post_likes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('post_like');
  return new;
end;
$$;

create function private.post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

revoke all on function private.post_likes_before_insert(), private.post_likes_count() from public, anon, authenticated;

create trigger post_likes_before_insert before insert on public.post_likes
  for each row execute function private.post_likes_before_insert();
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function private.post_likes_count();

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id, created_at desc);

alter table public.follows enable row level security;

revoke all on public.follows from anon, authenticated;
grant select on public.follows to anon, authenticated;
grant insert (followee_id) on public.follows to authenticated;
grant delete on public.follows to authenticated;

create policy "Follows are public" on public.follows
  for select to anon, authenticated using (true);
create policy "Users follow as themselves" on public.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "Users unfollow" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

create function private.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('follow');
  return new;
end;
$$;

revoke all on function private.follows_before_insert() from public, anon, authenticated;

create trigger follows_before_insert before insert on public.follows
  for each row execute function private.follows_before_insert();

-- ---------------------------------------------------------------------------
-- Following feed: top-level posts by people the caller follows, plus their own. Runs as the caller (RLS
-- applies). Keyset pagination on (created_at, id).
-- ---------------------------------------------------------------------------
create function public.following_feed(p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns setof public.posts
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.posts p
  where p.reply_to_id is null
    and (p.author_id = (select auth.uid())
      or p.author_id in (select f.followee_id from public.follows f where f.follower_id = (select auth.uid())))
    and (p_before is null or (p.created_at, p.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.following_feed(timestamptz, uuid, integer) from public, anon;
grant execute on function public.following_feed(timestamptz, uuid, integer) to authenticated;
