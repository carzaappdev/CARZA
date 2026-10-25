import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { clientEnv } from '@/env/client';
import { inter, sora } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: 'Carza: buy and sell cars locally', template: '%s · Carza' },
  applicationName: 'Carza',
  description: 'Find cars from local dealers and private sellers near you.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the `dark` class before hydration, so the server and client <html> differ.
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
