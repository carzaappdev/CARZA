import type { NextConfig } from 'next';
import { validateEnv } from './src/env/schema';

// Fail `next dev` / `next build` immediately if env vars are missing or malformed.
// SKIP_ENV_VALIDATION is only for tooling that loads this file without needing env (`next typegen`).
if (process.env.SKIP_ENV_VALIDATION !== '1') {
  validateEnv(process.env);
}

// Static security headers. The nonce-based Content-Security-Policy is added in the core-patterns stage.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
  poweredByHeader: false,
  typedRoutes: true,
  // Internal packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@carza/shared', '@carza/db'],
};

export default nextConfig;
