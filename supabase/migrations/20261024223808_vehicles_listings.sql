-- Vehicles (the physical car), listings (an offer to sell it), private locations, photos, saved listings.

-- ---------------------------------------------------------------------------
-- vehicles: owned by exactly one user OR one dealership. Reused by MyGarage later.
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles (id) on delete cascade,
  owner_dealership_id uuid references public.dealerships (id) on delete cascade,
  -- Not unique: the same car is legitimately relisted by different owners over time.
  vin text check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  year smallint not null check (year between 1900 and 2100),
  make_id smallint not null,
  model_id integer not null,
  trim_level text check (char_length(trim_level) <= 80),
  mileage integer not null check (mileage between 0 and 2000000),
  body_style public.body_style,
  drivetrain public.drivetrain,
  transmission public.transmission,
  fuel_type public.fuel_type,
  exterior_color text check (char_length(exterior_color) <= 40),
  interior_color text check (char_length(interior_color) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_one_owner check (num_nonnulls(owner_user_id, owner_dealership_id) = 1),
  -- The model must belong to the make.
  constraint vehicles_model_fk foreign key (make_id, model_id)
    references public.vehicle_models (make_id, id) on delete restrict,
  -- Targets for the listing → vehicle-owner composite FKs.
  constraint vehicles_id_owner_user_uniq unique (id, owner_user_id),
  constraint vehicles_id_owner_dealership_uniq unique (id, owner_dealership_id)
);

create index vehicles_make_model_idx on public.vehicles (make_id, model_id);
create index vehicles_model_idx on public.vehicles (model_id);
create index vehicles_year_idx on public.vehicles (year);
create index vehicles_mileage_idx on public.vehicles (mileage);
create index vehicles_vin_idx on public.vehicles (vin) where vin is not null;
create index vehicles_owner_user_idx on public.vehicles (owner_user_id) where owner_user_id is not null;
create index vehicles_owner_dealership_idx on public.vehicles (owner_dealership_id) where owner_dealership_id is not null;

create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  seller_user_id uuid references public.profiles (id) on delete cascade,
  seller_dealership_id uuid references public.dealerships (id) on delete cascade,
  status public.listing_status not null default 'draft',
  condition public.listing_condition not null default 'used',
  price_cents bigint not null check (price_cents between 100 and 1000000000),
  description text check (char_length(description) <= 5000),
  stock_number text check (char_length(stock_number) <= 40),
  -- PUBLIC point. Dealer listings: the dealership's location (set by trigger).
  -- Private listings: an approximate point (~1.5 km grid); the exact one is in listing_private_locations.
  location extensions.geography(point, 4326) not null,
  city text not null check (char_length(city) between 1 and 80),
  region text not null check (char_length(region) between 1 and 80),
  published_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_one_seller check (num_nonnulls(seller_user_id, seller_dealership_id) = 1),
  -- The seller must own the vehicle (MATCH SIMPLE: each FK only applies when its seller column is set).
  constraint listings_vehicle_user_fk foreign key (vehicle_id, seller_user_id)
    references public.vehicles (id, owner_user_id) on delete cascade,
  constraint listings_vehicle_dealership_fk foreign key (vehicle_id, seller_dealership_id)
    references public.vehicles (id, owner_dealership_id) on delete cascade,
  constraint listings_stock_number_dealer_only check (stock_number is null or seller_dealership_id is not null),
  -- Plain (non-partial) unique so CSV re-imports can upsert on it. NULLs never collide.
  constraint listings_dealer_stock_number_uniq unique (seller_dealership_id, stock_number)
);

-- One live (draft/active/pending) listing per vehicle.
create unique index listings_one_live_per_vehicle on public.listings (vehicle_id)
  where status in ('draft', 'active', 'pending');
create index listings_location_idx on public.listings using gist (location);
create index listings_status_published_idx on public.listings (status, published_at desc);
create index listings_active_price_idx on public.listings (price_cents) where status = 'active';
create index listings_seller_user_idx on public.listings (seller_user_id, status) where seller_user_id is not null;
create index listings_seller_dealership_idx on public.listings (seller_dealership_id, status) where seller_dealership_id is not null;
-- Cover the seller-owns-vehicle composite FKs (also serve plain vehicle_id lookups).
create index listings_vehicle_user_idx on public.listings (vehicle_id, seller_user_id);
create index listings_vehicle_dealership_idx on public.listings (vehicle_id, seller_dealership_id);

create trigger listings_set_updated_at before update on public.listings
  for each row execute function private.set_updated_at();

-- Server-controlled fields: public location, publish/sold timestamps, rate limits.
create function private.listings_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dealer record;
begin
  if new.seller_dealership_id is not null then
    -- Dealer listings always sit at the dealership.
    select d.location, d.city, d.region into v_dealer from public.dealerships d where d.id = new.seller_dealership_id;
    new.location := v_dealer.location;
    new.city := v_dealer.city;
    new.region := v_dealer.region;
  else
    -- Private sellers: the public point is ALWAYS approximate, whatever the client sends.
    new.location := private.approximate_point(new.location);
  end if;

  -- (Re)publishing resets the date so a relisted car doesn't sort by its original date.
  if new.status = 'active'
     and (new.published_at is null or (tg_op = 'UPDATE' and old.status not in ('active', 'pending'))) then
    new.published_at := now();
  end if;
  if new.status = 'sold' and (tg_op = 'INSERT' or old.status <> 'sold') then
    new.sold_at := now();
  elsif new.status <> 'sold' then
    new.sold_at := null;
  end if;

  if tg_op = 'INSERT' then
    if new.seller_dealership_id is not null then
      perform private.enforce_rate_limit('dealer_listing_create', new.seller_dealership_id);
    else
      perform private.enforce_rate_limit('listing_create');
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_before_write before insert or update on public.listings
  for each row execute function private.listings_before_write();

-- Can the current user manage (edit, add photos to) this listing?
create function private.can_manage_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and (
        l.seller_user_id = (select auth.uid())
        or (l.seller_dealership_id is not null and private.can_act_for_dealership(l.seller_dealership_id))
      )
  );
$$;

-- Keep dealer listings at the dealership's current address when it moves.
create function private.sync_dealer_listing_locations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.listings
  set location = new.location, city = new.city, region = new.region
  where seller_dealership_id = new.id;
  return null;
end;
$$;

create trigger dealerships_sync_listing_locations
  after update of location, city, region on public.dealerships
  for each row
  when (old.location is distinct from new.location or old.city is distinct from new.city or old.region is distinct from new.region)
  execute function private.sync_dealer_listing_locations();

revoke all on function private.can_manage_listing(uuid) from public;
grant execute on function private.can_manage_listing(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- listing_private_locations: exact point for private sellers. Seller-only.
-- ---------------------------------------------------------------------------
create table public.listing_private_locations (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  postal_code text check (postal_code ~ '^[0-9]{5}$'),
  updated_at timestamptz not null default now()
);

create trigger listing_private_locations_set_updated_at before update on public.listing_private_locations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- listing_photos
-- ---------------------------------------------------------------------------
create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Must live under the listing's own folder in the listing-photos bucket.
  storage_path text not null unique check (char_length(storage_path) <= 300),
  -- 0..29 + unique(listing_id, position) caps a listing at 30 photos.
  position smallint not null check (position between 0 and 29),
  width integer check (width between 1 and 20000),
  height integer check (height between 1 and 20000),
  created_at timestamptz not null default now(),
  constraint listing_photos_path_in_listing_folder check (storage_path like listing_id::text || '/%'),
  constraint listing_photos_position_uniq unique (listing_id, position) deferrable initially deferred
);


-- ---------------------------------------------------------------------------
-- saved_listings
-- ---------------------------------------------------------------------------
create table public.saved_listings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index saved_listings_listing_idx on public.saved_listings (listing_id);

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.vehicles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_private_locations enable row level security;
alter table public.listing_photos enable row level security;
alter table public.saved_listings enable row level security;

revoke all on public.vehicles, public.listings, public.listing_private_locations, public.listing_photos,
  public.saved_listings from anon, authenticated;

-- vehicles
grant select on public.vehicles to anon, authenticated;
-- No client-chosen ids, and ownership can never change after creation.
grant insert (
  owner_user_id, owner_dealership_id, vin, year, make_id, model_id, trim_level, mileage, body_style, drivetrain,
  transmission, fuel_type, exterior_color, interior_color
) on public.vehicles to authenticated;
grant update (
  vin, year, make_id, model_id, trim_level, mileage, body_style, drivetrain, transmission, fuel_type,
  exterior_color, interior_color
) on public.vehicles to authenticated;
grant delete on public.vehicles to authenticated;

create policy "Vehicles visible with their listings, or to their owners" on public.vehicles
  for select to anon, authenticated
  using (
    owner_user_id = (select auth.uid())
    or (owner_dealership_id is not null and private.is_dealership_member(owner_dealership_id))
    -- Inherits listings RLS: true only if the caller can see a listing for this vehicle.
    or exists (select 1 from public.listings l where l.vehicle_id = vehicles.id)
  );

create policy "Owners create vehicles" on public.vehicles
  for insert to authenticated
  with check (
    (owner_user_id = (select auth.uid()) and owner_dealership_id is null)
    or (owner_dealership_id is not null and owner_user_id is null and private.can_act_for_dealership(owner_dealership_id))
  );

create policy "Owners update vehicles" on public.vehicles
  for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (owner_dealership_id is not null and private.can_act_for_dealership(owner_dealership_id))
  )
  with check (
    owner_user_id = (select auth.uid())
    or (owner_dealership_id is not null and private.can_act_for_dealership(owner_dealership_id))
  );

-- A vehicle with any non-draft listing can't be deleted (that would cascade away live/sold listings and
-- the history attached to them). Remove the listing instead.
create policy "Owners delete vehicles without published listings" on public.vehicles
  for delete to authenticated
  using (
    (
      owner_user_id = (select auth.uid())
      or (owner_dealership_id is not null and private.can_act_for_dealership(owner_dealership_id))
    )
    and not exists (
      select 1 from public.listings l where l.vehicle_id = vehicles.id and l.status <> 'draft'
    )
  );

-- listings
grant select on public.listings to anon, authenticated;
grant insert (
  vehicle_id, seller_user_id, seller_dealership_id, status, condition, price_cents, description, stock_number,
  location, city, region
) on public.listings to authenticated;
grant update (status, condition, price_cents, description, stock_number, location, city, region)
  on public.listings to authenticated;
grant delete on public.listings to authenticated;

create policy "Public listings are visible; sellers see their own" on public.listings
  for select to anon, authenticated
  using (
    (
      status in ('active', 'pending', 'sold')
      and (seller_user_id is not null or private.is_verified_dealership(seller_dealership_id))
    )
    or seller_user_id = (select auth.uid())
    or (seller_dealership_id is not null and private.is_dealership_member(seller_dealership_id))
    or (select private.is_admin())
  );

-- Unverified dealerships can only create/keep drafts.
create policy "Sellers create listings" on public.listings
  for insert to authenticated
  with check (
    (seller_user_id = (select auth.uid()) and seller_dealership_id is null)
    or (
      seller_dealership_id is not null and seller_user_id is null
      and private.can_act_for_dealership(seller_dealership_id)
      and (status = 'draft' or private.is_verified_dealership(seller_dealership_id))
    )
  );

-- Sellers edit their own; app admins can moderate (e.g. status = 'removed' after a scam report).
create policy "Sellers and admins update listings" on public.listings
  for update to authenticated
  using (
    seller_user_id = (select auth.uid())
    or (seller_dealership_id is not null and private.can_act_for_dealership(seller_dealership_id))
    or (select private.is_admin())
  )
  with check (
    (seller_user_id = (select auth.uid()) and seller_dealership_id is null)
    or (
      seller_dealership_id is not null and seller_user_id is null
      and private.can_act_for_dealership(seller_dealership_id)
      and (status in ('draft', 'removed') or private.is_verified_dealership(seller_dealership_id))
    )
    or (select private.is_admin())
  );

create policy "Sellers delete draft listings" on public.listings
  for delete to authenticated
  using (
    status = 'draft'
    and (
      seller_user_id = (select auth.uid())
      or (seller_dealership_id is not null and private.can_act_for_dealership(seller_dealership_id))
    )
  );

-- listing_private_locations (seller-only for everything)
grant select, insert, update, delete on public.listing_private_locations to authenticated;

create policy "Sellers read exact location" on public.listing_private_locations
  for select to authenticated using (private.can_manage_listing(listing_id));
create policy "Sellers set exact location" on public.listing_private_locations
  for insert to authenticated with check (private.can_manage_listing(listing_id));
create policy "Sellers change exact location" on public.listing_private_locations
  for update to authenticated
  using (private.can_manage_listing(listing_id))
  with check (private.can_manage_listing(listing_id));
create policy "Sellers remove exact location" on public.listing_private_locations
  for delete to authenticated using (private.can_manage_listing(listing_id));

-- listing_photos
grant select on public.listing_photos to anon, authenticated;
grant insert (listing_id, storage_path, position, width, height), update (position), delete
  on public.listing_photos to authenticated;

create policy "Photos visible with their listing" on public.listing_photos
  for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_photos.listing_id));
create policy "Sellers add photos" on public.listing_photos
  for insert to authenticated with check (private.can_manage_listing(listing_id));
create policy "Sellers reorder photos" on public.listing_photos
  for update to authenticated
  using (private.can_manage_listing(listing_id))
  with check (private.can_manage_listing(listing_id));
create policy "Sellers delete photos" on public.listing_photos
  for delete to authenticated using (private.can_manage_listing(listing_id));

-- saved_listings
grant select, insert, delete on public.saved_listings to authenticated;

create policy "Users see their saved listings" on public.saved_listings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users save visible listings" on public.saved_listings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.listings l where l.id = saved_listings.listing_id)
  );
create policy "Users unsave listings" on public.saved_listings
  for delete to authenticated using (user_id = (select auth.uid()));
