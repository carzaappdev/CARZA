'use client';

import { useEffect } from 'react';
import { markNotificationsRead } from '@/lib/actions/notifications';
import { NOTIFICATIONS_SEEN } from './bell';

/** Opening the page marks everything read (the dots stay until the next visit) and clears the badge. */
export function MarkNotificationsRead() {
  useEffect(() => {
    void markNotificationsRead().then(() => window.dispatchEvent(new Event(NOTIFICATIONS_SEEN)));
  }, []);
  return null;
}
