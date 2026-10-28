-- Feed upgrades: #tags (with tag pages and trending), @mention notifications, and a ranked "For you".
-- The tag/mention rules match packages/shared/src/logic/rich-text.ts.

-- ---------------------------------------------------------------------------
-- Tags: extracted from the body on insert (posts can't be edited), never client-set.
-- ---------------------------------------------------------------------------
alter table public.posts add column tags text[] not null default '{}' check (cardinality(tags) <= 10);
create index posts_tags_idx on public.posts using gin (tags);

create function private.post_tags(p_body text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(t.tag order by t.first), '{}')
  from (
    select lower(m[1]) as tag, min(m.ord) as first
    from regexp_matches(coalesce(p_body, ''), '(?:^|[^A-Za-z0-9_])#([A-Za-z][A-Za-z0-9_]{1,29})(?![A-Za-z0-9_])', 'g')
      with ordinality as m(m, ord)
    group by lower(m[1])
    order by min(m.ord)
    limit 10
  ) t;
$$;

create function private.posts_set_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.tags := private.post_tags(new.body);
  return new;
end;
$$;

revoke all on function private.post_tags(text), private.posts_set_tags() from public, anon, authenticated;

create trigger posts_set_tags before insert on public.posts
  for each row execute function private.posts_set_tags();

-- Popular tags in the last p_days, for search and suggestions. Runs as the caller (RLS applies).
create function public.trending_tags(p_days integer default 7, p_limit integer default 12)
returns table (tag text, post_count bigint)
language sql
stable
set search_path = ''
as $$
  select t.tag, count(*) as post_count
  from public.posts p, unnest(p.tags) as t(tag)
  where p.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
  group by t.tag
  order by count(*) desc, t.tag
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke all on function public.trending_tags(integer, integer) from public;
grant execute on function public.trending_tags(integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- @mentions notify the people named (up to 10 per post; not yourself, not across a block).
-- ---------------------------------------------------------------------------
create function private.notify_on_mention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_author uuid;
begin
  if new.reply_to_id is not null then
    select p.author_id into v_parent_author from public.posts p where p.id = new.reply_to_id;
  end if;
  insert into public.notifications (user_id, type, data)
  select pr.id, 'mention', jsonb_build_object(
    'actor_id', new.author_id, 'post_id', new.id, 'snippet', private.snippet(new.body)
  )
  from (
    select distinct lower(m[1]) as username
    from regexp_matches(new.body, '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,30})(?![A-Za-z0-9_])', 'g') as m
    limit 10
  ) u
  join public.profiles pr on pr.username = u.username
  where pr.id <> new.author_id
    -- The parent's author already gets a reply notification.
    and pr.id is distinct from v_parent_author
    and not private.is_blocked_pair(pr.id, new.author_id);
  return null;
end;
$$;

revoke all on function private.notify_on_mention() from public, anon, authenticated;

create trigger posts_notify_mention after insert on public.posts
  for each row execute function private.notify_on_mention();

-- ---------------------------------------------------------------------------
-- Ranked "For you": the newest 1,000 top-level posts, scored by engagement that decays with age, with a
-- boost for people near you, people you follow and photos. Security definer to compare locations
-- (which stay private); blocks are applied by hand because RLS doesn't run here.
-- ---------------------------------------------------------------------------
create function public.for_you_feed(p_offset integer default 0, p_limit integer default 20)
returns setof public.posts
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select
      (select auth.uid()) as id,
      (select pp.location from public.profile_private pp where pp.user_id = (select auth.uid())) as location
  ),
  candidates as (
    select p.*
    from public.posts p
    where p.reply_to_id is null
      and p.reel_id is null
      and p.author_id <> all (coalesce(private.blocked_ids(), '{}'))
    order by p.created_at desc
    limit 1000
  )
  select c.id, c.author_id, c.reply_to_id, c.body, c.photos, c.like_count, c.reply_count, c.created_at,
    c.event_id, c.reel_id, c.tags
  from candidates c
  left join public.profile_private ap on ap.user_id = c.author_id
  order by
    (c.like_count + 2 * c.reply_count + 1)::double precision
      * (case when (select location from me) is not null and ap.location is not null
          and extensions.st_dwithin(ap.location, (select location from me), 80467) then 1.5 else 1 end)
      * (case when exists (
          select 1 from public.follows f where f.follower_id = (select id from me) and f.followee_id = c.author_id
        ) then 1.3 else 1 end)
      * (case when jsonb_array_length(c.photos) > 0 then 1.2 else 1 end)
      / power(extract(epoch from (now() - c.created_at)) / 3600 + 2, 1.5)
    desc,
    c.created_at desc,
    c.id desc
  offset least(greatest(coalesce(p_offset, 0), 0), 1000)
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.for_you_feed(integer, integer) from public;
grant execute on function public.for_you_feed(integer, integer) to anon, authenticated;
