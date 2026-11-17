-- Guests picked their own id, so a script could send a new random id on every call
-- and add unlimited views (the rate limit is keyed on that same id).
-- Views now count signed-in viewers only. p_guest_id stays in the signature so the
-- currently deployed app keeps working; it's ignored and can be dropped in a later PR.
create or replace function public.record_reel_view(p_reel_id uuid, p_guest_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := (select auth.uid());
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

revoke execute on function public.record_reel_view(uuid, uuid) from anon;
