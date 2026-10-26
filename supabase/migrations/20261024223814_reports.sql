-- Reports (flag a listing / user / message / dealership). Day-one anti-scam tooling.
-- A snapshot of the reported content is stored so evidence survives edits and deletion.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 2000),
  target_snapshot jsonb not null default '{}'::jsonb,
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index reports_one_per_target_uniq on public.reports (reporter_id, target_type, target_id);
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);
create index reports_resolved_by_idx on public.reports (resolved_by);

create function private.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('report_create');
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  new.target_snapshot := case new.target_type
    when 'listing' then (
      select jsonb_build_object(
        'status', l.status, 'price_cents', l.price_cents, 'description', l.description,
        'seller_user_id', l.seller_user_id, 'seller_dealership_id', l.seller_dealership_id,
        'vehicle', jsonb_build_object('year', v.year, 'make_id', v.make_id, 'model_id', v.model_id, 'vin', v.vin)
      )
      from public.listings l join public.vehicles v on v.id = l.vehicle_id where l.id = new.target_id
    )
    when 'message' then (
      select jsonb_build_object('conversation_id', m.conversation_id, 'sender_id', m.sender_id, 'body', m.body, 'sent_at', m.created_at)
      from public.messages m where m.id = new.target_id
    )
    when 'user' then (
      select jsonb_build_object('username', p.username, 'display_name', p.display_name, 'bio', p.bio)
      from public.profiles p where p.id = new.target_id
    )
    when 'dealership' then (
      select jsonb_build_object('name', d.name, 'slug', d.slug, 'website', d.website, 'phone', d.phone)
      from public.dealerships d where d.id = new.target_id
    )
  end;
  return new;
end;
$$;

create trigger reports_before_insert before insert on public.reports
  for each row execute function private.reports_before_insert();

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, details) on public.reports to authenticated;
grant update (status, resolved_by, resolved_at) on public.reports to authenticated;

create policy "Reporters see their reports; admins see all" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select private.is_admin()));

-- You can only report things you can actually see (the subqueries run under your own RLS),
-- so report ids can't be used to probe for hidden content.
create policy "Users report visible content" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and case target_type
      when 'listing' then exists (select 1 from public.listings l where l.id = target_id)
      when 'message' then exists (select 1 from public.messages m where m.id = target_id)
      when 'user' then exists (select 1 from public.profiles p where p.id = target_id and p.id <> (select auth.uid()))
      when 'dealership' then exists (select 1 from public.dealerships d where d.id = target_id)
    end
  );

create policy "Admins triage reports" on public.reports
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
