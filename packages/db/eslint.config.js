import { defineConfig } from 'eslint/config';
import base from '@carza/config/eslint/base';

export default defineConfig(base, {
  // Tests assert on API results whose types are nullable; `!` after an assertion is clearer than guards.
  files: ['**/*.test.ts', 'tests/**'],
  rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
});
