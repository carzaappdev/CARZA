'use server';

import { revalidatePath } from 'next/cache';
import {
  eventFormSchema,
  eventIdSchema,
  fail,
  ok,
  setRsvpSchema,
  updateEventSchema,
  type ActionResult,
} from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type DbError = { code?: string; message?: string };

/** Maps database refusals (triggers, constraints, rate limits) to messages people can act on. */
function eventError(error: DbError, userId: string, op: string) {
  if (error.code === 'CZ429')
    return fail('RATE_LIMITED', 'You’ve created a lot of events today. Try again tomorrow.');
  if (error.code === '22023' && error.message?.includes('ZIP')) {
    return fail('VALIDATION', 'We don’t recognize that ZIP code.', {
      postalCode: ['We don’t recognize that ZIP code.'],
    });
  }
  if (error.code === '22023')
    return fail('VALIDATION', 'Pick a start time in the future.', {
      startsAt: ['Pick a start time in the future.'],
    });
  if (error.code === '42501') return fail('FORBIDDEN', 'This event can’t be changed.');
  console.error(`${op} failed`, { code: error.code, userId });
  return fail('INTERNAL', 'Couldn’t save the event. Try again.');
}

function toRow(e: ReturnType<typeof eventFormSchema.parse>) {
  return {
    title: e.title,
    description: e.description,
    starts_at: e.startsAt,
    ends_at: e.endsAt,
    timezone: e.timezone,
    venue_name: e.venueName,
    address: e.address,
    postal_code: e.postalCode,
    capacity: e.capacity,
    cover_path: e.coverPath,
  };
}

function invalid(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path.at(-1) ?? 'form');
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail('VALIDATION', 'Check the highlighted fields.', fieldErrors);
}

async function coverIsTheirs(path: string | null, userId: string) {
  if (!path) return true;
  if (!path.startsWith(`${userId}/`)) return false;
  const supabase = await createClient();
  const { data } = await supabase.storage.from('post-photos').exists(path);
  return data;
}

export async function createEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to host an event.');
  if (!(await coverIsTheirs(parsed.data.coverPath, user.id))) {
    return fail('VALIDATION', 'The cover photo didn’t finish uploading. Try adding it again.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .insert(toRow(parsed.data))
    .select('id')
    .single();
  if (error) return eventError(error, user.id, 'createEvent');
  revalidatePath('/events');
  return ok({ id: data.id });
}

export async function updateEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  const { eventId, event } = parsed.data;
  if (!(await coverIsTheirs(event.coverPath, user.id))) {
    return fail('VALIDATION', 'The cover photo didn’t finish uploading. Try adding it again.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .update(toRow(event))
    .eq('id', eventId)
    .select('id');
  if (error) return eventError(error, user.id, 'updateEvent');
  if (data.length === 0) return fail('NOT_FOUND', 'That event isn’t yours or no longer exists.');
  revalidatePath('/events');
  revalidatePath(`/events/${eventId}`);
  return ok({ id: eventId });
}

export async function cancelEvent(input: unknown): Promise<ActionResult<null>> {
  const parsed = eventIdSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    // The database replaces this with its own clock.
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', parsed.data.eventId)
    .select('id');
  if (error) return eventError(error, user.id, 'cancelEvent');
  if (data.length === 0) return fail('NOT_FOUND', 'That event isn’t yours or no longer exists.');
  revalidatePath('/events');
  revalidatePath(`/events/${parsed.data.eventId}`);
  return ok(null);
}

export async function setRsvp(input: unknown): Promise<ActionResult<{ going: boolean }>> {
  const parsed = setRsvpSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to RSVP.');

  const { eventId, going } = parsed.data;
  const supabase = await createClient();
  const { error } = going
    ? await supabase
        .from('event_rsvps')
        .upsert({ event_id: eventId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    : await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', user.id);
  if (error) {
    if (error.code === 'CZ409') return fail('CONFLICT', 'Sorry, this event is full.');
    if (error.code === 'CZ429') return fail('RATE_LIMITED', 'Slow down a little and try again.');
    if (error.code === '22023')
      return fail(
        'CONFLICT',
        error.message.includes('cancelled') ? 'This event was cancelled.' : 'This event has ended.',
      );
    if (error.code === '23503') return fail('NOT_FOUND', 'That event no longer exists.');
    console.error('setRsvp failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update your RSVP. Try again.');
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
  return ok({ going });
}
