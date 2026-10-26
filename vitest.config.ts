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
    ],
  },
});
