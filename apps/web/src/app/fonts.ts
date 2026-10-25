import { Inter, Sora } from 'next/font/google';

// Self-hosted at build time by next/font (no runtime requests to Google).
export const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
export const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});
