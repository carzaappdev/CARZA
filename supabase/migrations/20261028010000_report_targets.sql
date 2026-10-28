-- Social content can be reported too. Enum values must be committed before policies can use them, so they
-- get their own migration.
alter type public.report_target add value if not exists 'post';
alter type public.report_target add value if not exists 'reel';
alter type public.report_target add value if not exists 'event';
