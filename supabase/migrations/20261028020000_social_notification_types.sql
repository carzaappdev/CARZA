-- Notification types for the social app. Own migration so the values commit before triggers use them.
alter type public.notification_type add value if not exists 'new_follower';
alter type public.notification_type add value if not exists 'post_like';
alter type public.notification_type add value if not exists 'post_reply';
alter type public.notification_type add value if not exists 'mention';
alter type public.notification_type add value if not exists 'reel_like';
alter type public.notification_type add value if not exists 'reel_comment';
alter type public.notification_type add value if not exists 'event_rsvp';
alter type public.notification_type add value if not exists 'event_reminder';
alter type public.notification_type add value if not exists 'event_cancelled';
