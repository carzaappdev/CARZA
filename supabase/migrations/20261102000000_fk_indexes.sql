-- Cover the last foreign keys the database advisor flags as unindexed, so deletes of a make/model
-- or a profile don't scan these tables. One (make_id, model_id) index covers both garage_cars keys.
create index if not exists garage_cars_make_model_idx on public.garage_cars (make_id, model_id);
create index if not exists profile_private_invited_by_idx on public.profile_private (invited_by);
