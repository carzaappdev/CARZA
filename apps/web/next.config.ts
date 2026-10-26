import type { NextConfig } from 'next';
import { validateEnv } from './src/env/schema';

// Fail `next dev` / `next build` immediately if env vars are missing or malformed.
// SKIP_ENV_VALIDATION is only for tooling that loads this file without needing env (`next typegen`).
if (process.env.SKIP_ENV_VALIDATION !== '1') {
  validateEnv(process.env);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Internal packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@carza/shared', '@carza/db'],
};

export default nextConfig;
