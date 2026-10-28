import { ImageResponse } from 'next/og';
import { z } from 'zod';
import { getEvent } from '@carza/db';
import { formatEventWhen } from '@carza/shared';
import { publicStorageUrl } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

export const alt = 'Carza event';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The preview card when an event link is shared in a group chat or on social. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = z.guid().safeParse(id).success
    ? await getEvent(await createClient(), id, null)
    : null;
  const title = event?.title ?? 'Car event on Carza';
  const when = event ? formatEventWhen(event.starts_at, event.ends_at, event.timezone) : '';
  const where = event ? [event.venue_name, event.city].filter(Boolean).join(' · ') : '';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: '#0b0d12',
        color: 'white',
        fontFamily: 'sans-serif',
      }}
    >
      {event?.cover_path ? (
        <img
          src={publicStorageUrl('post-photos', event.cover_path)}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            inset: 0,
            objectFit: 'cover',
            width: '100%',
            height: '100%',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.25) 70%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '64px 72px',
          gap: 18,
          width: '100%',
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 8, fontWeight: 700, opacity: 0.85 }}>CARZA</div>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, display: 'flex' }}>
          {title}
        </div>
        {when ? <div style={{ fontSize: 34, opacity: 0.9 }}>{when}</div> : null}
        {where ? <div style={{ fontSize: 30, opacity: 0.7 }}>{where}</div> : null}
        {event ? (
          <div
            style={{ fontSize: 28, opacity: 0.7 }}
          >{`${event.going_count} going · RSVP on Carza`}</div>
        ) : null}
      </div>
    </div>,
    size,
  );
}
