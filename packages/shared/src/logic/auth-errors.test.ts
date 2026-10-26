import { describe, expect, it } from 'vitest';
import { authErrorMessage, GENERIC_AUTH_ERROR } from './auth-errors';

describe('authErrorMessage', () => {
  it('maps known codes', () => {
    expect(authErrorMessage('invalid_credentials')).toMatch(/don’t match/);
  });
  it('never echoes unknown input', () => {
    expect(authErrorMessage('<script>alert(1)</script>')).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage('toString')).toBe(GENERIC_AUTH_ERROR);
  });
});
