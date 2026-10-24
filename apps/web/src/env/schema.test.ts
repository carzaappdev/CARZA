import { describe, expect, it } from 'vitest';
import { validateEnv } from './schema';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
};

describe('validateEnv', () => {
  it('accepts the minimum dev config', () => {
    expect(validateEnv(valid).NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000');
  });

  it('lists every missing variable', () => {
    expect(() => validateEnv({})).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY[\s\S]*NEXT_PUBLIC_SITE_URL/,
    );
  });

  it('treats empty strings as missing', () => {
    expect(() => validateEnv({ ...valid, NEXT_PUBLIC_SITE_URL: '' })).toThrowError(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });

  it('requires email settings on production deploys only', () => {
    expect(() => validateEnv({ ...valid, VERCEL_ENV: 'preview' })).not.toThrow();
    expect(() => validateEnv({ ...valid, VERCEL_ENV: 'production' })).toThrowError(
      /RESEND_API_KEY[\s\S]*EMAIL_FROM/,
    );
  });

  it('does not echo secret values in the error', () => {
    expect.assertions(1);
    try {
      validateEnv({ ...valid, RESEND_API_KEY: 'not-a-real-key-123' });
    } catch (e) {
      expect(String(e)).not.toContain('not-a-real-key-123');
    }
  });
});
