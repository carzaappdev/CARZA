import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'Carza: your local car scene';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The default preview card when any Carza link is shared. Built once at build time. */
export default async function Image() {
  const mark = await readFile(join(process.cwd(), 'public/brand/carza-mark-white.png'));
  const src = `data:image/png;base64,${mark.toString('base64')}`;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        background:
          'radial-gradient(60% 55% at 50% 40%, rgba(255,255,255,0.16), transparent 70%), #0b0c10',
        color: 'white',
        fontFamily: 'sans-serif',
      }}
    >
      <img src={src} alt="" width={620} height={200} />
      <div style={{ fontSize: 40, letterSpacing: 18, fontWeight: 800 }}>CARZA</div>
      <div style={{ fontSize: 34, opacity: 0.75 }}>Your local car scene, all in one place.</div>
    </div>,
    size,
  );
}
