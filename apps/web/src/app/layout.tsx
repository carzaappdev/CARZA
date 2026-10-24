import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { clientEnv } from '@/env/client';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: 'Carza: buy and sell cars locally', template: '%s · Carza' },
  description: 'Find cars from local dealers and private sellers near you.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Single color until dark mode (next-themes) lands in the app-shell stage.
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
