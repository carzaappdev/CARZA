-- Foundation: extensions, enums, shared helpers.
-- Conventions (see docs/ARCHITECTURE.md §2):
--   * every table: RLS on, explicit grants (revoke all, then grant what's needed), per-operation policies
--   * security definer functions: search_path = '' and fully-qualified names
--   * (select auth.uid()) in policies so it is evaluated once per statement

create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Internal schema for helpers used by policies/triggers. NOT exposed by the Data API (only `public` is),
-- so nothing here is callable over HTTP. Roles need USAGE so RLS policies can call the helpers.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums (mirrored in @carza/shared/constants; a unit test checks for drift)
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('user', 'admin');
-- Declared lowest → highest so `role >= 'admin'` works via enum ordering.
create type public.dealer_role as enum ('staff', 'admin', 'owner');
create type public.verification_status as enum ('pending', 'verified', 'rejected', 'suspended');
create type public.listing_status as enum ('draft', 'active', 'pending', 'sold', 'removed');
create type public.listing_condition as enum ('new', 'used', 'certified');
create type public.body_style as enum (
  'sedan', 'coupe', 'hatchback', 'wagon', 'convertible', 'suv', 'crossover', 'pickup', 'minivan', 'van', 'other'
);
create type public.drivetrain as enum ('fwd', 'rwd', 'awd', '4wd');
create type public.transmission as enum ('automatic', 'manual', 'cvt', 'dct');
create type public.fuel_type as enum (
  'gasoline', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'flex', 'other'
);
create type public.test_drive_status as enum ('requested', 'confirmed', 'declined', 'cancelled', 'completed');
create type public.notification_type as enum (
  'new_message',
  'test_drive_requested',
  'test_drive_confirmed',
  'test_drive_declined',
  'test_drive_cancelled',
  'dealership_verified',
  'dealership_rejected',
  'dealership_invite'
);
create type public.report_target as enum ('listing', 'user', 'message', 'dealership');
create type public.report_reason as enum ('scam', 'spam', 'offensive', 'misleading', 'stolen', 'other');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True if `tz` is a valid IANA timezone name. Marked immutable so it can be used in CHECK constraints
-- (the tz database only changes with a Postgres upgrade).
create function private.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end;
$$;

-- Casts text to uuid, returning null instead of raising. Used by storage policies on user-supplied paths.
create function private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

-- Turns "Joe's Auto Sales!" into "joes-auto-sales".
create function private.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(regexp_replace(value, '[''’]', '', 'g')), '[^a-z0-9]+', '-', 'g'));
$$;
