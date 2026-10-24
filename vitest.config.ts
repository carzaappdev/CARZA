import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          // Real RLS tests against the LOCAL Supabase stack (`supabase start`). Run with `pnpm test:rls`.
          name: 'rls',
          include: ['packages/db/tests/rls/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['packages/db/tests/rls/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
