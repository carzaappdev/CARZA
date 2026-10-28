-- In-app notifications for the social app: follows, likes, replies, RSVPs, event reminders and
-- cancellations. Rows are only written by these triggers (security definer); users can read, mark read
-- and delete their own (policies from the profiles_notifications migration).
--
-- data always holds ids plus short display text, never full bodies:
--   actor_id    who did it (absent for reminders)
--   post_id / reel_id / event_id
--   count       likes only: how many people liked it since you last looked
--   snippet     up to 80 characters of the post, reel caption or event title

-- One unread "likes" row per post or reel; new likes bump it instead of adding rows.
create unique index notifications_unread_like_uniq on public.notifications (
  user_id, type, (coalesce(data ->> 'post_id', data ->> 'reel_id'))
) where type in ('post_like', 'reel_like') and read_at is null;

create function private.snippet(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(btrim(coalesce(p_text, ''))) > 80
    then left(btrim(p_text), 79) || '…' else btrim(coalesce(p_text, '')) end;
$$;

-- Adds a like to the recipient's unread "likes" row for this post/reel, or starts one.
create function private.notify_like(p_user_id uuid, p_type public.notification_type, p_key text, p_id uuid, p_actor uuid, p_snippet text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id = p_actor then
    return;
  end if;
  insert into public.notifications (user_id, type, data)
  values (p_user_id, p_type, jsonb_build_object(p_key, p_id, 'actor_id', p_actor, 'count', 1, 'snippet', private.snippet(p_snippet)))
  on conflict (user_id, type, (coalesce(data ->> 'post_id', data ->> 'reel_id'))) where type in ('post_like', 'reel_like') and read_at is null
  do update set
    data = public.notifications.data || jsonb_build_object(
      'actor_id', p_actor,
      'count', coalesce((public.notifications.data ->> 'count')::int, 1) + 1
    ),
    created_at = now();
end;
$$;

revoke all on function private.snippet(text), private.notify_like(uuid, public.notification_type, text, uuid, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function private.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Unfollow + refollow shouldn't stack up duplicates.
  delete from public.notifications
  where user_id = new.followee_id and type = 'new_follower' and read_at is null
    and data ->> 'actor_id' = new.follower_id::text;
  perform private.notify(new.followee_id, 'new_follower', jsonb_build_object('actor_id', new.follower_id));
  return null;
end;
$$;

create function private.notify_on_post_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post record;
begin
  select p.author_id, p.body into v_post from public.posts p where p.id = new.post_id;
  if found then
    perform private.notify_like(v_post.author_id, 'post_like', 'post_id', new.post_id, new.user_id, v_post.body);
  end if;
  return null;
end;
$$;

create function private.notify_on_reel_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reel record;
begin
  select r.author_id, r.caption into v_reel from public.reels r where r.id = new.reel_id;
  if found then
    perform private.notify_like(v_reel.author_id, 'reel_like', 'reel_id', new.reel_id, new.user_id, v_reel.caption);
  end if;
  return null;
end;
$$;

create function private.notify_on_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_author uuid;
begin
  if new.reply_to_id is null then
    return null;
  end if;
  select p.author_id into v_parent_author from public.posts p where p.id = new.reply_to_id;
  if found and v_parent_author <> new.author_id then
    perform private.notify(v_parent_author, 'post_reply', jsonb_build_object(
      'actor_id', new.author_id, 'post_id', new.id, 'parent_id', new.reply_to_id, 'snippet', private.snippet(new.body)
    ));
  end if;
  return null;
end;
$$;

create function private.notify_on_rsvp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
begin
  select e.host_id, e.title into v_event from public.events e where e.id = new.event_id;
  if found and v_event.host_id <> new.user_id then
    perform private.notify(v_event.host_id, 'event_rsvp', jsonb_build_object(
      'actor_id', new.user_id, 'event_id', new.event_id, 'snippet', private.snippet(v_event.title)
    ));
  end if;
  return null;
end;
$$;

-- Tell everyone going when the host cancels.
create function private.notify_on_event_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.cancelled_at is null and new.cancelled_at is not null then
    insert into public.notifications (user_id, type, data)
    select r.user_id, 'event_cancelled', jsonb_build_object(
      'actor_id', new.host_id, 'event_id', new.id, 'snippet', private.snippet(new.title)
    )
    from public.event_rsvps r
    where r.event_id = new.id and r.user_id <> new.host_id;
  end if;
  return null;
end;
$$;

revoke all on function private.notify_on_follow(), private.notify_on_post_like(), private.notify_on_reel_like(),
  private.notify_on_reply(), private.notify_on_rsvp(), private.notify_on_event_cancel()
  from public, anon, authenticated;

create trigger follows_notify after insert on public.follows
  for each row execute function private.notify_on_follow();
create trigger post_likes_notify after insert on public.post_likes
  for each row execute function private.notify_on_post_like();
create trigger reel_likes_notify after insert on public.reel_likes
  for each row execute function private.notify_on_reel_like();
create trigger posts_notify_reply after insert on public.posts
  for each row execute function private.notify_on_reply();
create trigger event_rsvps_notify after insert on public.event_rsvps
  for each row execute function private.notify_on_rsvp();
create trigger events_notify_cancel after update of cancelled_at on public.events
  for each row execute function private.notify_on_event_cancel();

-- ---------------------------------------------------------------------------
-- Event reminders: about a day before, everyone going gets one. Runs every 15 minutes with pg_cron.
-- ---------------------------------------------------------------------------
alter table public.events add column reminded_at timestamptz;

create function private.send_event_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with due as (
    update public.events e set reminded_at = now()
    where e.reminded_at is null
      and e.cancelled_at is null
      and e.starts_at > now()
      and e.starts_at <= now() + interval '24 hours'
    returning e.id, e.title, e.starts_at
  )
  insert into public.notifications (user_id, type, data)
  select r.user_id, 'event_reminder', jsonb_build_object(
    'event_id', d.id, 'snippet', private.snippet(d.title), 'starts_at', d.starts_at
  )
  from due d join public.event_rsvps r on r.event_id = d.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.send_event_reminders() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule('event-reminders', '*/15 * * * *', $$select private.send_event_reminders()$$);

-- Read notifications older than 90 days are cleared nightly.
select cron.schedule(
  'prune-notifications',
  '17 4 * * *',
  $$delete from public.notifications where read_at is not null and created_at < now() - interval '90 days'$$
);
