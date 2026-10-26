import { execFileSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

// Reads URL + keys from the LOCAL Supabase stack (`supabase start`). Never points at a remote project.
export default function setup(project: TestProject) {
  let raw: string;
  try {
    raw = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(
      'Local Supabase is not running. Start it with `supabase start` before `pnpm test:rls`.',
    );
  }
  const status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
  const url = status.API_URL ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error(`Refusing to run RLS tests against a non-local Supabase: ${url}`);
  }
  project.provide('supabaseUrl', url);
  project.provide('publishableKey', status.PUBLISHABLE_KEY ?? status.ANON_KEY ?? '');
  project.provide('secretKey', status.SECRET_KEY ?? status.SERVICE_ROLE_KEY ?? '');
}

declare module 'vitest' {
  export interface ProvidedContext {
    supabaseUrl: string;
    publishableKey: string;
    secretKey: string;
  }
}
