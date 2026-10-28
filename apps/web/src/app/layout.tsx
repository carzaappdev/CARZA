import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { THEME_COLORS } from '@/components/theme/colors';
import { ThemeColor } from '@/components/theme/theme-color';
import { Toaster } from '@/components/ui/sonner';
import { clientEnv } from '@/env/client';
import { inter, sora } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: 'Carza: your local car scene', template: '%s · Carza' },
  applicationName: 'Carza',
  description:
    'Share your ride, swipe through car reels and find meets, cruises and shows near you.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
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
          <ThemeColor />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
