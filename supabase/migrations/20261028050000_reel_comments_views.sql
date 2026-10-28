-- Reels get comments and view counts.
--
-- Comments are posts with reel_id set (top-level only), so likes, replies, reports, blocks and deletion
-- all work the same as everywhere else. They stay out of the feeds.
-- Views count once per viewer per reel: the signed-in user, or a random id the browser keeps for guests.

alter table public.posts add column reel_id uuid references public.reels (id) on delete cascade;
alter table public.posts add constraint posts_reel_top_level check (reel_id is null or reply_to_id is null);
alter table public.posts add constraint posts_one_parent check (reel_id is null or event_id is null);

create index posts_reel_idx on public.posts (reel_id, created_at desc) where reel_id is not null;
-- The feed index now also skips reel comments.
drop index public.posts_feed_idx;
create index posts_feed_idx on public.posts (created_at desc, id desc) where reply_to_id is null and reel_id is null;

grant insert (reel_id) on public.posts to authenticated;

alter table public.reels add column comment_count integer not null default 0 check (comment_count >= 0);
alter table public.reels add column view_count integer not null default 0 check (view_count >= 0);

create or replace function private.posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('post_create');
  if new.reply_to_id is not null and exists (
    select 1 from public.posts p
    where p.id = new.reply_to_id and private.is_blocked_pair(new.author_id, p.author_id)
  ) then
    raise exception 'You can’t reply to this account' using errcode = '42501';
  end if;
  if new.event_id is not null and exists (
    select 1 from public.events e
    where e.id = new.event_id and private.is_blocked_pair(new.author_id, e.host_id)
  ) then
    raise exception 'You can’t post to this event' using errcode = '42501';
  end if;
  if new.reel_id is not null and exists (
    select 1 from public.reels r
    where r.id = new.reel_id and private.is_blocked_pair(new.author_id, r.author_id)
  ) then
    raise exception 'You can’t comment on this reel' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.posts_reel_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reel record;
begin
  if tg_op = 'INSERT' and new.reel_id is not null then
    update public.reels set comment_count = comment_count + 1 where id = new.reel_id
    returning author_id, caption into v_reel;
    if found and v_reel.author_id <> new.author_id then
      perform private.notify(v_reel.author_id, 'reel_comment', jsonb_build_object(
        'actor_id', new.author_id, 'reel_id', new.reel_id, 'post_id', new.id, 'snippet', private.snippet(new.body)
      ));
    end if;
  elsif tg_op = 'DELETE' and old.reel_id is not null then
    update public.reels set comment_count = greatest(comment_count - 1, 0) where id = old.reel_id;
  end if;
  return null;
end;
$$;

revoke all on function private.posts_reel_comment() from public, anon, authenticated;

create trigger posts_reel_comment after insert or delete on public.posts
  for each row execute function private.posts_reel_comment();

-- Following feed: also skip reel comments.
create or replace function public.following_feed(p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns setof public.posts
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.posts p
  where p.reply_to_id is null
    and p.reel_id is null
    and (p.author_id = (select auth.uid())
      or p.author_id in (select f.followee_id from public.follows f where f.follower_id = (select auth.uid())))
    and (p_before is null or (p.created_at, p.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
create table private.reel_views (
  reel_id uuid not null references public.reels (id) on delete cascade,
  viewer uuid not null,
  created_at timestamptz not null default now(),
  primary key (reel_id, viewer)
);
alter table private.reel_views enable row level security;

insert into private.rate_limit_buckets (bucket, max_count, window_seconds) values
  ('reel_view', 600, 3600);

-- Signed-in viewers count as themselves; guests pass the random id their browser keeps.
create function public.record_reel_view(p_reel_id uuid, p_guest_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := coalesce(auth.uid(), p_guest_id);
begin
  if v_viewer is null then
    return;
  end if;
  perform private.enforce_rate_limit('reel_view', v_viewer);
  insert into private.reel_views (reel_id, viewer) values (p_reel_id, v_viewer)
  on conflict do nothing;
  if found then
    update public.reels set view_count = view_count + 1 where id = p_reel_id;
  end if;
exception
  when foreign_key_violation then
    return;
end;
$$;

revoke all on function public.record_reel_view(uuid, uuid) from public;
grant execute on function public.record_reel_view(uuid, uuid) to anon, authenticated;
