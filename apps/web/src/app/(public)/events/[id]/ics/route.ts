import { z } from 'zod';
import { getEvent } from '@carza/db';
import { eventToIcs } from '@carza/shared';
import { clientEnv } from '@/env/client';
import { createClient } from '@/lib/supabase/server';
import { eventCalendarInfo } from '@/lib/event-calendar';

/** Download the event as an .ics file (Apple Calendar, Outlook). Public, like the event page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) return new Response('Not found', { status: 404 });
  const event = await getEvent(await createClient(), id, null);
  if (!event || event.cancelled_at) return new Response('Not found', { status: 404 });

  return new Response(eventToIcs(eventCalendarInfo(event, clientEnv.NEXT_PUBLIC_SITE_URL)), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="carza-event.ics"',
      'Cache-Control': 'private, max-age=60',
    },
  });
}
