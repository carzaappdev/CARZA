import { ImageResponse } from 'next/og';
import { SITE_DESCRIPTION, SITE_TAGLINE } from '@/lib/site';

export const alt = `Carza: ${SITE_TAGLINE.toLowerCase()}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The default share card for any page without its own (built once at deploy). */
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 96px',
        gap: 28,
        color: 'white',
        fontFamily: 'sans-serif',
        background: 'radial-gradient(70% 60% at 50% 30%, #1f2633 0%, #0b0d12 70%), #0b0d12',
      }}
    >
      <div style={{ fontSize: 40, letterSpacing: 16, fontWeight: 800 }}>CARZA</div>
      <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>{SITE_TAGLINE}</div>
      <div style={{ fontSize: 36, opacity: 0.72, lineHeight: 1.3, maxWidth: 900 }}>
        {SITE_DESCRIPTION}
      </div>
    </div>,
    size,
  );
}
