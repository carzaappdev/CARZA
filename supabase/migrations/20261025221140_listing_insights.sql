-- Buyer-facing insights for a page of listings: photo count and an estimated market price from comparable
-- listings (same model, model year within 2, same new/used class; active, pending, or sold in the last year).
-- SECURITY INVOKER, so only listings the caller can already see are counted or compared.

create function public.listing_insights(p_listing_ids uuid[])
returns table (
  listing_id uuid,
  photo_count integer,
  market_price_cents bigint,
  comparable_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    l.id,
    (select count(*)::integer from public.listing_photos ph where ph.listing_id = l.id),
    -- An estimate needs at least 5 comparables. With a usable mileage trend (price falls as miles rise),
    -- adjust the average to this car's mileage; otherwise use the median. The adjustment is kept within
    -- 50%-150% of the median so a far-off mileage can't extrapolate to a silly number.
    case when est.n >= 5 then
      round(
        greatest(
          least(
            case when est.slope < 0 then est.avg_price + est.slope * (v.mileage - est.avg_mileage)
                 else est.median end,
            est.median * 1.5
          ),
          est.median * 0.5
        )
      )::bigint
    end,
    est.n
  from public.listings l
  join public.vehicles v on v.id = l.vehicle_id
  cross join lateral (
    select
      count(*)::integer as n,
      avg(c.price_cents) as avg_price,
      avg(cv.mileage) as avg_mileage,
      regr_slope(c.price_cents, cv.mileage) as slope,
      percentile_cont(0.5) within group (order by c.price_cents) as median
    from public.listings c
    join public.vehicles cv on cv.id = c.vehicle_id
    where cv.model_id = v.model_id
      and cv.year between v.year - 2 and v.year + 2
      and (c.condition = 'new') = (l.condition = 'new')
      and c.id <> l.id
      and (
        c.status in ('active', 'pending')
        or (c.status = 'sold' and c.sold_at > now() - interval '12 months')
      )
  ) est
  -- One page of results at most.
  where l.id = any (p_listing_ids[1:48]);
$$;

grant execute on function public.listing_insights(uuid[]) to anon, authenticated;
