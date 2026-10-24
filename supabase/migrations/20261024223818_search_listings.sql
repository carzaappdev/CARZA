-- Radius + filter search over active listings. SECURITY INVOKER: listings RLS still applies.
-- Distances in meters internally; the UI converts from/to miles (@carza/shared).

create function public.search_listings(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_miles integer default 50,
  p_make_id smallint default null,
  p_model_id integer default null,
  p_year_min smallint default null,
  p_year_max smallint default null,
  p_price_min_cents bigint default null,
  p_price_max_cents bigint default null,
  p_mileage_max integer default null,
  p_body_styles public.body_style[] default null,
  p_drivetrains public.drivetrain[] default null,
  p_fuel_types public.fuel_type[] default null,
  p_transmissions public.transmission[] default null,
  p_condition public.listing_condition default null,
  p_seller_type text default null,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  listing_id uuid,
  price_cents bigint,
  condition public.listing_condition,
  city text,
  region text,
  published_at timestamptz,
  year smallint,
  make_name text,
  model_name text,
  trim_level text,
  mileage integer,
  body_style public.body_style,
  drivetrain public.drivetrain,
  transmission public.transmission,
  fuel_type public.fuel_type,
  photo_path text,
  seller_type text,
  seller_name text,
  distance_m double precision,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      case when p_lat is not null and p_lng is not null
        then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
      end as origin,
      least(greatest(coalesce(p_radius_miles, 50), 1), 500) * 1609.344 as radius_m,
      least(greatest(coalesce(p_limit, 24), 1), 48) as lim,
      least(greatest(coalesce(p_offset, 0), 0), 1000) as off
  ),
  matches as (
    select
      l.id,
      l.price_cents,
      l.condition,
      l.city,
      l.region,
      l.published_at,
      v.year,
      mk.name as make_name,
      md.name as model_name,
      v.trim_level,
      v.mileage,
      v.body_style,
      v.drivetrain,
      v.transmission,
      v.fuel_type,
      l.seller_user_id,
      l.seller_dealership_id,
      case when p.origin is not null then extensions.st_distance(l.location, p.origin) end as distance_m
    from public.listings l
    cross join params p
    join public.vehicles v on v.id = l.vehicle_id
    join public.vehicle_makes mk on mk.id = v.make_id
    join public.vehicle_models md on md.id = v.model_id
    where l.status = 'active'
      and (p.origin is null or extensions.st_dwithin(l.location, p.origin, p.radius_m))
      and (p_make_id is null or v.make_id = p_make_id)
      and (p_model_id is null or v.model_id = p_model_id)
      and (p_year_min is null or v.year >= p_year_min)
      and (p_year_max is null or v.year <= p_year_max)
      and (p_price_min_cents is null or l.price_cents >= p_price_min_cents)
      and (p_price_max_cents is null or l.price_cents <= p_price_max_cents)
      and (p_mileage_max is null or v.mileage <= p_mileage_max)
      and (p_body_styles is null or v.body_style = any (p_body_styles))
      and (p_drivetrains is null or v.drivetrain = any (p_drivetrains))
      and (p_fuel_types is null or v.fuel_type = any (p_fuel_types))
      and (p_transmissions is null or v.transmission = any (p_transmissions))
      and (p_condition is null or l.condition = p_condition)
      and (
        p_seller_type is null
        or (p_seller_type = 'private' and l.seller_user_id is not null)
        or (p_seller_type = 'dealer' and l.seller_dealership_id is not null)
      )
  ),
  page as (
    select m.*, count(*) over () as total_count
    from matches m
    order by
      case when p_sort = 'price_asc' then m.price_cents end asc,
      case when p_sort = 'price_desc' then m.price_cents end desc,
      case when p_sort = 'mileage_asc' then m.mileage end asc,
      case when p_sort = 'year_desc' then m.year end desc,
      case when p_sort = 'distance' then m.distance_m end asc nulls last,
      m.published_at desc nulls last,
      m.id
    limit (select lim from params)
    offset (select off from params)
  )
  select
    pg.id,
    pg.price_cents,
    pg.condition,
    pg.city,
    pg.region,
    pg.published_at,
    pg.year,
    pg.make_name,
    pg.model_name,
    pg.trim_level,
    pg.mileage,
    pg.body_style,
    pg.drivetrain,
    pg.transmission,
    pg.fuel_type,
    (select ph.storage_path from public.listing_photos ph where ph.listing_id = pg.id order by ph.position limit 1),
    case when pg.seller_dealership_id is not null then 'dealer' else 'private' end,
    coalesce(
      (select d.name from public.dealerships d where d.id = pg.seller_dealership_id),
      (select pr.display_name from public.profiles pr where pr.id = pg.seller_user_id)
    ),
    pg.distance_m,
    pg.total_count
  from page pg
  order by
    case when p_sort = 'price_asc' then pg.price_cents end asc,
    case when p_sort = 'price_desc' then pg.price_cents end desc,
    case when p_sort = 'mileage_asc' then pg.mileage end asc,
    case when p_sort = 'year_desc' then pg.year end desc,
    case when p_sort = 'distance' then pg.distance_m end asc nulls last,
    pg.published_at desc nulls last,
    pg.id;
$$;

grant execute on function public.search_listings(
  double precision, double precision, integer, smallint, integer, smallint, smallint, bigint, bigint, integer,
  public.body_style[], public.drivetrain[], public.fuel_type[], public.transmission[], public.listing_condition,
  text, text, integer, integer
) to anon, authenticated;
