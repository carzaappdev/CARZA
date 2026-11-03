-- Self-service account deletion (App Store / Play require it in-app).
-- Deleting the auth user cascades through profiles to every row the user owns (posts, likes, follows,
-- events, RSVPs, reels, garage, blocks, notifications). Their Storage files are removed by the app first,
-- as the user, under the existing "delete your own files" policies.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
