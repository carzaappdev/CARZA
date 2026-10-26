import { defineConfig } from 'eslint/config';
import next from '@carza/config/eslint/next';

export default defineConfig(next, { ignores: ['.next/**', 'next-env.d.ts'] });
