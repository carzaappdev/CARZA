-- Rate limiting, enforced INSIDE the database so it cannot be skipped by calling the API directly.
-- Callers (triggers / RPCs) run `perform private.enforce_rate_limit('bucket')`; when over the limit it
-- raises SQLSTATE CZ429, which the app maps to RATE_LIMITED.

create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (key, window_start)
);
-- Not reachable through the API (schema is unexposed and has no grants), but RLS on anyway by convention.
alter table private.rate_limits enable row level security;

create function private.enforce_rate_limit(p_bucket text, p_subject uuid default null)
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
  -- Limits apply to API callers. Direct SQL (migrations, seed, admin scripts in the SQL editor) has no JWT,
  -- and the service role is trusted server code; both skip. Signed-in API calls always count.
  if auth.role() is null or auth.role() = 'service_role' then
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
      ('dealer_listing_create', 1000, 86400),
      ('photo_upload', 200, 3600),
      ('test_drive_request', 5, 3600),
      ('test_drive_request', 10, 86400),
      ('report_create', 20, 86400),
      ('dealer_apply', 3, 86400),
      ('invite_send', 50, 86400)
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

revoke all on function private.enforce_rate_limit(text, uuid) from public, anon, authenticated;
