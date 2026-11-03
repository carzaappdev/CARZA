-- The official Carza account: a verified badge nobody else can get, brand usernames nobody else can
-- take, and first place in "people to follow".

-- ---------------------------------------------------------------------------
-- Official flag. No grant: users can't set it; only SQL / service role can.
-- ---------------------------------------------------------------------------
alter table public.profiles add column official boolean not null default false;

-- ---------------------------------------------------------------------------
-- Reserved usernames: Carza's own handles and staff-sounding names. Only the official account or
-- staff (admins) can take one. Names people already have are left alone.
-- ---------------------------------------------------------------------------
create function private.is_reserved_username(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_username ~ '^carza_?(app|official|team|support|help|hq|staff|news|events|reels)?$'
    or p_username = any (array[
      'admin', 'administrator', 'official', 'support', 'help', 'helpdesk', 'team', 'staff', 'mod',
      'moderator', 'moderators', 'security', 'safety', 'trust', 'root', 'system', 'settings',
      'about', 'legal', 'privacy', 'terms', 'everyone', 'null', 'undefined'
    ]);
$$;

create function private.profiles_reserved_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_reserved_username(new.username) and not (new.official or new.role = 'admin')
     and (tg_op = 'INSERT' or old.username is distinct from new.username) then
    -- Same code as a duplicate, so people just see "That username is taken."
    raise exception 'That username is taken' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function private.profiles_reserved_username() from public, anon, authenticated;

create trigger profiles_reserved_username before insert or update of username on public.profiles
  for each row execute function private.profiles_reserved_username();

-- ---------------------------------------------------------------------------
-- People to follow: the official account first, then as before.
-- (Return type changes, so drop and recreate.)
-- ---------------------------------------------------------------------------
drop function public.suggested_follows(integer);

create function public.suggested_follows(p_limit integer default 12)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  bio text,
  city text,
  region text,
  featured boolean,
  official boolean,
  follower_count bigint,
  shared_makes integer,
  nearby boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id,
      (select pp.location from public.profile_private pp where pp.user_id = (select auth.uid())) as location
  ),
  my_makes as (
    select distinct g.make_id from public.garage_cars g where g.owner_id = (select id from me)
  ),
  candidates as (
    select p.*, pp.location
    from public.profiles p
    left join public.profile_private pp on pp.user_id = p.id
    where p.id <> coalesce((select id from me), '00000000-0000-0000-0000-000000000000'::uuid)
      and not exists (select 1 from public.follows f where f.follower_id = (select id from me) and f.followee_id = p.id)
      and p.id <> all (coalesce(private.blocked_ids(), '{}'))
  )
  select
    c.id, c.username, c.display_name, c.avatar_path, c.bio, c.city, c.region,
    c.featured_at is not null as featured,
    c.official,
    (select count(*) from public.follows f where f.followee_id = c.id) as follower_count,
    (select count(distinct g.make_id)::int from public.garage_cars g where g.owner_id = c.id and g.make_id in (select make_id from my_makes)) as shared_makes,
    -- Within ~50 miles. Only a yes/no, so exact locations can't be worked out.
    coalesce(extensions.st_dwithin(c.location, (select location from me), 80467), false) as nearby
  from candidates c
  order by
    c.official desc,
    (c.featured_at is not null) desc,
    nearby desc,
    shared_makes desc,
    follower_count desc,
    c.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke all on function public.suggested_follows(integer) from public;
grant execute on function public.suggested_follows(integer) to anon, authenticated;
