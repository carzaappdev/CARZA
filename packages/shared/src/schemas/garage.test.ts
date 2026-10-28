import { describe, expect, it } from 'vitest';
import { garageCarSchema, garageYears } from './garage';

describe('garageCarSchema', () => {
  it('coerces form values and blanks the nickname', () => {
    expect(
      garageCarSchema.parse({
        year: '2019',
        makeId: '3',
        modelId: '41',
        nickname: '  ',
        photoPath: null,
      }),
    ).toEqual({ year: 2019, makeId: 3, modelId: 41, nickname: null, photoPath: null });
  });
  it('rejects years in the future and photos outside a user folder', () => {
    const year = new Date().getFullYear() + 2;
    expect(
      garageCarSchema.safeParse({ year, makeId: 1, modelId: 1, nickname: '', photoPath: null })
        .success,
    ).toBe(false);
    expect(
      garageCarSchema.safeParse({
        year: 2000,
        makeId: 1,
        modelId: 1,
        nickname: '',
        photoPath: '../x.jpg',
      }).success,
    ).toBe(false);
  });
  it('offers next model year first', () => {
    expect(garageYears(new Date('2026-06-01'))[0]).toBe(2027);
  });
});
