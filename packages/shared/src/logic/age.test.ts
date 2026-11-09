import { describe, expect, it } from 'vitest';
import { ageGroup, ageOn, parseBirthDate } from './age';
import { birthDateSchema } from '../schemas/auth';

const now = new Date('2026-11-09T12:00:00Z');

describe('ageOn', () => {
  it('counts whole years, turning over on the birthday', () => {
    expect(ageOn('2013-11-09', now)).toBe(13);
    expect(ageOn('2013-11-10', now)).toBe(12);
    expect(ageOn('2008-11-09', now)).toBe(18);
    expect(ageOn('2008-12-01', now)).toBe(17);
  });

  it('rejects things that are not real dates', () => {
    expect(parseBirthDate('2020-02-30')).toBeNull();
    expect(parseBirthDate('11/09/2000')).toBeNull();
    expect(ageOn('nope', now)).toBeNull();
  });
});

describe('ageGroup', () => {
  it('splits at 18', () => {
    expect(ageGroup(13)).toBe('teen');
    expect(ageGroup(17)).toBe('teen');
    expect(ageGroup(18)).toBe('adult');
  });
});

describe('birthDateSchema', () => {
  it('accepts a past date and refuses future or impossible ones', () => {
    expect(birthDateSchema.safeParse('1990-05-17').success).toBe(true);
    expect(birthDateSchema.safeParse('2999-01-01').success).toBe(false);
    expect(birthDateSchema.safeParse('1800-01-01').success).toBe(false);
    expect(birthDateSchema.safeParse('').success).toBe(false);
  });
});
