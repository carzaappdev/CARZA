import { describe, expect, it } from 'vitest';
import { garageCarSchema, garageModSchema, garageYears } from './garage';

describe('garageCarSchema', () => {
  it('coerces form values and blanks the nickname', () => {
    expect(
      garageCarSchema.parse({
        year: '2019',
        makeId: '3',
        modelId: '41',
        nickname: '  ',
      }),
    ).toEqual({
      year: 2019,
      makeId: 3,
      modelId: 41,
      trimLevel: null,
      nickname: null,
      story: null,
      photoPaths: [],
    });
  });
  it('rejects years in the future and photos outside a user folder', () => {
    const year = new Date().getFullYear() + 2;
    expect(garageCarSchema.safeParse({ year, makeId: 1, modelId: 1 }).success).toBe(false);
    expect(
      garageCarSchema.safeParse({
        year: 2000,
        makeId: 1,
        modelId: 1,
        photoPaths: ['../x.jpg'],
      }).success,
    ).toBe(false);
  });
  it('caps photos at 8 and rejects duplicates', () => {
    const path = (i: number) =>
      `${'a'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}/${'b'.repeat(8)}-0000-4000-8000-${String(i).padStart(12, '0')}.jpg`;
    const base = { year: 2000, makeId: 1, modelId: 1 };
    expect(
      garageCarSchema.safeParse({
        ...base,
        photoPaths: Array.from({ length: 8 }, (_, i) => path(i)),
      }).success,
    ).toBe(true);
    expect(
      garageCarSchema.safeParse({
        ...base,
        photoPaths: Array.from({ length: 9 }, (_, i) => path(i)),
      }).success,
    ).toBe(false);
    expect(garageCarSchema.safeParse({ ...base, photoPaths: [path(1), path(1)] }).success).toBe(
      false,
    );
  });
  it('offers next model year first', () => {
    expect(garageYears(new Date('2026-06-01'))[0]).toBe(2027);
  });
});

describe('garageModSchema', () => {
  const carId = '6f1c1f0e-2b9a-4c43-9d5e-3f1b2a7c8d90';
  it('trims the name and checks the category', () => {
    expect(garageModSchema.parse({ carId, category: 'suspension', name: ' Coilovers ' })).toEqual({
      carId,
      category: 'suspension',
      name: 'Coilovers',
    });
    expect(garageModSchema.safeParse({ carId, category: 'rockets', name: 'x' }).success).toBe(
      false,
    );
    expect(garageModSchema.safeParse({ carId, category: 'brakes', name: '  ' }).success).toBe(
      false,
    );
  });
});
