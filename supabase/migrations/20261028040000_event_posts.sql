-- Posts can belong to an event: the event page shows them as its discussion and photo wall, and the feed
-- shows which event a post is from. Only top-level posts (replies follow their parent).

alter table public.posts add column event_id uuid references public.events (id) on delete cascade;
alter table public.posts add constraint posts_event_top_level check (event_id is null or reply_to_id is null);

create index posts_event_idx on public.posts (event_id, created_at desc) where event_id is not null;

grant insert (event_id) on public.posts to authenticated;

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
  return new;
end;
$$;
