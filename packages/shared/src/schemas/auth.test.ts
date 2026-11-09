import { describe, expect, it } from 'vitest';
import { fieldErrors, signInSchema, signUpSchema, updatePasswordSchema } from './auth';

describe('auth schemas', () => {
  it('normalizes email', () => {
    const r = signInSchema.parse({ email: '  Me@Example.COM ', password: 'x' });
    expect(r.email).toBe('me@example.com');
  });

  it('enforces the password policy on sign-up', () => {
    const birthDate = '1990-05-17';
    const bad = signUpSchema.safeParse({
      displayName: 'A',
      email: 'a@b.co',
      password: 'short1',
      birthDate,
    });
    expect(bad.success).toBe(false);
    const noDigit = signUpSchema.safeParse({
      displayName: 'A',
      email: 'a@b.co',
      password: 'longenoughpassword',
      birthDate,
    });
    expect(noDigit.success).toBe(false);
    const ok = signUpSchema.safeParse({
      displayName: ' Ana ',
      email: 'a@b.co',
      password: 'longenough1',
      birthDate,
    });
    expect(ok.success && ok.data.displayName).toBe('Ana');
    const noBirthDate = signUpSchema.safeParse({
      displayName: 'Ana',
      email: 'a@b.co',
      password: 'longenough1',
    });
    expect(noBirthDate.success).toBe(false);
  });

  it('requires matching passwords and reports the field', () => {
    const r = updatePasswordSchema.safeParse({
      password: 'longenough1',
      confirmPassword: 'longenough2',
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(fieldErrors(r.error)).toEqual({ confirmPassword: "Passwords don't match." });
  });
});
