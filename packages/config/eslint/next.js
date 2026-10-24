// Flat ESLint config for the Next.js app: Next's rules (react, hooks, a11y, import) + our base.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import base from './base.js';

export default [
  ...nextVitals,
  ...nextTs,
  ...base,
  {
    rules: {
      // Server-only secrets must never be read from a client file; env.ts is the single entry point.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Import from "@/env/client" or "@/env/server" instead of reading process.env directly.',
        },
      ],
    },
  },
  {
    files: ['src/env/**', '*.config.*', 'proxy.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
];
