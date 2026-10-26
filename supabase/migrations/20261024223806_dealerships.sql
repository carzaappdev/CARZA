-- Dealerships, their members (owner/admin/staff), and team invitations.

create table public.dealerships (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text check (char_length(description) <= 2000),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 254),
  website text check (website ~ '^https?://' and char_length(website) <= 300),
  address_line1 text not null check (char_length(address_line1) between 1 and 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text not null check (char_length(city) between 1 and 80),
  region text not null check (char_length(region) between 1 and 80),
  postal_code text not null check (char_length(postal_code) between 3 and 12),
  location extensions.geography(point, 4326) not null,
  -- IANA timezone; test drive times are shown in this zone.
  timezone text not null check (private.is_valid_timezone(timezone)),
  logo_path text check (char_length(logo_path) <= 300 and logo_path like id::text || '/%' and position('..' in logo_path) = 0),
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dealerships_location_idx on public.dealerships using gist (location);
create index dealerships_verification_idx on public.dealerships (verification_status);
create index dealerships_created_by_idx on public.dealerships (created_by);

create trigger dealerships_set_updated_at before update on public.dealerships
  for each row execute function private.set_updated_at();

create table public.dealership_members (
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.dealer_role not null,
  created_at timestamptz not null default now(),
  primary key (dealership_id, user_id)
);

create index dealership_members_user_idx on public.dealership_members (user_id);

create table public.dealership_invitations (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.dealer_role not null check (role <> 'owner'),
  -- Cascade: an inviter's open invitations die with their account (no orphaned admin invites).
  invited_by uuid references public.profiles (id) on delete cascade,
  -- sha256 of the token; the plain token only ever exists in the invite email.
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index dealership_invitations_invited_by_idx on public.dealership_invitations (invited_by);
create unique index dealership_invitations_open_uniq on public.dealership_invitations (dealership_id, email)
  where accepted_at is null;

-- ---------------------------------------------------------------------------
-- Membership helpers (used by policies everywhere)
-- ---------------------------------------------------------------------------
create function private.is_dealership_member(
  p_dealership_id uuid,
  p_min_role public.dealer_role default 'staff'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dealership_members m
    where m.dealership_id = p_dealership_id
      and m.user_id = (select auth.uid())
      and m.role >= p_min_role
  );
$$;

create function private.is_verified_dealership(p_dealership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dealerships d where d.id = p_dealership_id and d.verification_status = 'verified'
  );
$$;

-- Write-side check: a member of a dealership that is allowed to operate. Suspended or rejected dealerships
-- keep read access to their data but can't message, take test drives, invite, or change inventory.
create function private.can_act_for_dealership(
  p_dealership_id uuid,
  p_min_role public.dealer_role default 'staff'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_dealership_member(p_dealership_id, p_min_role)
    and exists (
      select 1 from public.dealerships d
      where d.id = p_dealership_id and d.verification_status in ('pending', 'verified')
    );
$$;

revoke all on function private.is_dealership_member(uuid, public.dealer_role) from public;
revoke all on function private.is_verified_dealership(uuid) from public;
revoke all on function private.can_act_for_dealership(uuid, public.dealer_role) from public;
grant execute on function private.is_dealership_member(uuid, public.dealer_role) to anon, authenticated;
grant execute on function private.is_verified_dealership(uuid) to anon, authenticated;
grant execute on function private.can_act_for_dealership(uuid, public.dealer_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
-- A dealership must always keep at least one owner. Exceptions:
--   * the dealership itself is being deleted (cascade), and
--   * the owner's account is being deleted (cascade from profiles): account deletion must never be
--     blocked, so the dealership is suspended instead (listings hidden, staff can't act) for an admin to
--     resolve.
create function private.keep_one_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'owner' or (tg_op = 'UPDATE' and new.role = 'owner') then
    return coalesce(new, old);
  end if;
  -- Serialize owner changes per dealership (two owners demoting each other at once).
  perform 1 from public.dealerships d where d.id = old.dealership_id for update;
  if not found then
    return coalesce(new, old);
  end if;
  if exists (
    select 1 from public.dealership_members m
    where m.dealership_id = old.dealership_id and m.role = 'owner' and m.user_id <> old.user_id
  ) then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.profiles p where p.id = old.user_id) then
    update public.dealerships set verification_status = 'suspended' where id = old.dealership_id;
    return old;
  end if;
  raise exception 'A dealership must have at least one owner. Transfer ownership first.' using errcode = 'P0001';
end;
$$;

-- When someone leaves the team or is demoted to staff, their outstanding invitations die with their access.
create function private.revoke_member_invitations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.role = 'staff' then
    delete from public.dealership_invitations i
    where i.dealership_id = old.dealership_id and i.invited_by = old.user_id and i.accepted_at is null;
  end if;
  return null;
end;
$$;

create trigger dealership_members_revoke_invitations
  after update of role or delete on public.dealership_members
  for each row execute function private.revoke_member_invitations();

-- Verification vouches for the business identity. Changing it sends the dealership back for review.
create function private.reverify_on_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.verification_status = 'verified'
     and new.verification_status = 'verified'
     and (new.name, new.website, new.phone, new.email, new.logo_path, new.address_line1, new.address_line2,
          new.city, new.region, new.postal_code, extensions.st_astext(new.location::extensions.geometry))
       is distinct from
         (old.name, old.website, old.phone, old.email, old.logo_path, old.address_line1, old.address_line2,
          old.city, old.region, old.postal_code, extensions.st_astext(old.location::extensions.geometry))
  then
    new.verification_status := 'pending';
    new.verified_at := null;
  end if;
  return new;
end;
$$;

create trigger dealerships_reverify_on_identity_change
  before update on public.dealerships
  for each row execute function private.reverify_on_identity_change();

create trigger dealership_members_keep_one_owner
  before update or delete on public.dealership_members
  for each row execute function private.keep_one_owner();

-- Notify owners when verification status changes.
create function private.on_dealership_verification_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.notification_type;
  v_owner uuid;
begin
  if new.verification_status = old.verification_status then
    return new;
  end if;
  new.verified_at := case when new.verification_status = 'verified' then now() else null end;
  v_type := case new.verification_status
    when 'verified' then 'dealership_verified'::public.notification_type
    when 'rejected' then 'dealership_rejected'::public.notification_type
    else null
  end;
  if v_type is not null then
    for v_owner in
      select m.user_id from public.dealership_members m where m.dealership_id = new.id and m.role = 'owner'
    loop
      perform private.notify(v_owner, v_type, jsonb_build_object('dealership_id', new.id, 'dealership_name', new.name));
    end loop;
  end if;
  return new;
end;
$$;

create trigger dealerships_verification_change
  before update of verification_status on public.dealerships
  for each row execute function private.on_dealership_verification_change();

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.dealerships enable row level security;
alter table public.dealership_members enable row level security;
alter table public.dealership_invitations enable row level security;

revoke all on public.dealerships, public.dealership_members, public.dealership_invitations from anon, authenticated;

grant select on public.dealerships to anon, authenticated;
-- verification_status / verified_at / slug / created_by are never client-writable.
grant update (
  name, description, phone, email, website, address_line1, address_line2, city, region, postal_code,
  location, timezone, logo_path
) on public.dealerships to authenticated;

create policy "Verified dealerships are public; members and admins see their own" on public.dealerships
  for select to anon, authenticated
  using (
    verification_status = 'verified'
    or private.is_dealership_member(id)
    or (select private.is_admin())
  );

create policy "Dealership admins update their dealership" on public.dealerships
  for update to authenticated
  using (private.can_act_for_dealership(id, 'admin'))
  with check (private.can_act_for_dealership(id, 'admin'));
-- Insert only via apply_for_dealership(); no delete (suspend instead).

grant select, delete, update (role) on public.dealership_members to authenticated;

create policy "Members see their team" on public.dealership_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_dealership_member(dealership_id) or (select private.is_admin()));

-- Owners manage everyone; admins manage non-owners and can't promote to owner.
create policy "Owners and admins change roles" on public.dealership_members
  for update to authenticated
  using (
    private.can_act_for_dealership(dealership_id, 'owner')
    or (private.can_act_for_dealership(dealership_id, 'admin') and role <> 'owner')
  )
  with check (
    private.can_act_for_dealership(dealership_id, 'owner')
    or (private.can_act_for_dealership(dealership_id, 'admin') and role <> 'owner')
  );

create policy "Owners/admins remove members; anyone can leave" on public.dealership_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_act_for_dealership(dealership_id, 'owner')
    or (private.can_act_for_dealership(dealership_id, 'admin') and role <> 'owner')
  );
-- Insert only via apply_for_dealership() / accept_dealership_invitation().

grant select, delete on public.dealership_invitations to authenticated;

create policy "Dealership admins see invitations" on public.dealership_invitations
  for select to authenticated using (private.is_dealership_member(dealership_id, 'admin'));

create policy "Dealership admins revoke invitations" on public.dealership_invitations
  for delete to authenticated using (private.is_dealership_member(dealership_id, 'admin'));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function public.apply_for_dealership(
  p_name text,
  p_address_line1 text,
  p_city text,
  p_region text,
  p_postal_code text,
  p_lat double precision,
  p_lng double precision,
  p_timezone text,
  p_address_line2 text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_base text;
  v_slug text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  perform private.enforce_rate_limit('dealer_apply');

  if exists (
    select 1 from public.dealerships d
    join public.dealership_members m on m.dealership_id = d.id
    where m.user_id = v_uid and m.role = 'owner' and d.verification_status = 'pending'
  ) then
    raise exception 'You already have a dealership application pending review.' using errcode = 'P0001';
  end if;

  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location' using errcode = '22023';
  end if;

  v_base := left(private.slugify(p_name), 50);
  if char_length(v_base) < 3 then
    v_base := 'dealer';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.dealerships where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.dealerships (
    slug, name, description, phone, email, website, address_line1, address_line2, city, region,
    postal_code, location, timezone, created_by
  ) values (
    v_slug, btrim(p_name), p_description, p_phone, lower(p_email), p_website, p_address_line1, p_address_line2,
    p_city, p_region, p_postal_code,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    p_timezone, v_uid
  ) returning id into v_id;

  insert into public.dealership_members (dealership_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end;
$$;

-- Admin-only. Until there's an admin UI, run from the SQL editor as an admin user, or update directly
-- as the postgres role.
create function public.set_dealership_verification(p_dealership_id uuid, p_status public.verification_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can change verification status' using errcode = '42501';
  end if;
  update public.dealerships set verification_status = p_status where id = p_dealership_id;
  if not found then
    raise exception 'Dealership not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Returns the plain token (to put in the invite email). Only its hash is stored.
create function public.create_dealership_invitation(
  p_dealership_id uuid,
  p_email text,
  p_role public.dealer_role default 'staff'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not private.can_act_for_dealership(p_dealership_id, 'admin') then
    raise exception 'Only dealership owners and admins can invite' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Invite as admin, then transfer ownership' using errcode = '22023';
  end if;
  perform private.enforce_rate_limit('invite_send');

  -- Replace any previous open invite for the same email.
  delete from public.dealership_invitations
  where dealership_id = p_dealership_id and email = lower(btrim(p_email)) and accepted_at is null;

  insert into public.dealership_invitations (dealership_id, email, role, invited_by, token_hash)
  values (p_dealership_id, lower(btrim(p_email)), p_role, auth.uid(), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));

  return v_token;
end;
$$;

create function public.accept_dealership_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.dealership_invitations;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid and u.email_confirmed_at is not null;

  select i.* into v_invite from public.dealership_invitations i
  join public.dealerships d on d.id = i.dealership_id
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and i.accepted_at is null
    and i.expires_at > now()
    and d.verification_status in ('pending', 'verified')
  for update of i;

  -- Same error for "no such token" and "wrong account" so tokens can't be probed.
  if v_invite.id is null or v_email is null or v_invite.email <> v_email then
    raise exception 'This invitation is invalid or has expired.' using errcode = 'P0001';
  end if;

  insert into public.dealership_members (dealership_id, user_id, role)
  values (v_invite.dealership_id, v_uid, v_invite.role)
  on conflict (dealership_id, user_id) do nothing;

  update public.dealership_invitations set accepted_at = now() where id = v_invite.id;
  return v_invite.dealership_id;
end;
$$;

revoke all on function public.apply_for_dealership(text, text, text, text, text, double precision, double precision, text, text, text, text, text, text) from public, anon;
revoke all on function public.set_dealership_verification(uuid, public.verification_status) from public, anon;
revoke all on function public.create_dealership_invitation(uuid, text, public.dealer_role) from public, anon;
revoke all on function public.accept_dealership_invitation(text) from public, anon;
grant execute on function public.apply_for_dealership(text, text, text, text, text, double precision, double precision, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_dealership_verification(uuid, public.verification_status) to authenticated;
grant execute on function public.create_dealership_invitation(uuid, text, public.dealer_role) to authenticated;
grant execute on function public.accept_dealership_invitation(text) to authenticated;
