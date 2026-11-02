-- Guests hear about time or place changes. Own migration so the value commits before the trigger uses it.
alter type public.notification_type add value if not exists 'event_updated';
