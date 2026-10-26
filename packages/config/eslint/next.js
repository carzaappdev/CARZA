// Flat ESLint config for the Next.js app: Next's rules (react, hooks, a11y, import) + our base.
import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import base from './base.js';

export default defineConfig(
  nextVitals,
  nextTs,
  base,
  {
    rules: {
      // Env vars are read only in src/env/* (validated). NODE_ENV is fine anywhere.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name!='NODE_ENV']",
          message: 'Import from "@/env/client" or "@/env/server" instead of reading process.env.',
        },
      ],
    },
  },
  {
    files: ['src/env/**', '*.config.*', 'src/proxy.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
