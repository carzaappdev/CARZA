import { describe, expect, it } from 'vitest';
import { matchVehicleQuery } from './vehicle-query';

const makes = [
  { id: 1, name: 'Chevrolet', slug: 'chevrolet' },
  { id: 2, name: 'Ford', slug: 'ford' },
  { id: 3, name: 'Land Rover', slug: 'land-rover' },
  { id: 4, name: 'Honda', slug: 'honda' },
  { id: 5, name: 'Tesla', slug: 'tesla' },
  { id: 6, name: 'Rover', slug: 'rover' },
];
const models = [
  { id: 10, make_id: 1, name: 'Silverado 1500', slug: 'silverado-1500' },
  { id: 11, make_id: 1, name: 'Silverado', slug: 'silverado' },
  { id: 20, make_id: 2, name: 'F-150', slug: 'f-150' },
  { id: 21, make_id: 2, name: 'Escape', slug: 'escape' },
  { id: 30, make_id: 3, name: 'Defender', slug: 'defender' },
  { id: 40, make_id: 4, name: 'CR-V', slug: 'cr-v' },
  { id: 50, make_id: 5, name: 'Model 3', slug: 'model-3' },
  { id: 60, make_id: 6, name: 'Escape', slug: 'escape' },
];

const ids = (q: string) => {
  const r = matchVehicleQuery(q, makes, models);
  return { make: r.make?.id, model: r.model?.id, year: r.year };
};

describe('matchVehicleQuery', () => {
  it('matches make, model and year', () => {
    expect(ids('2019 Chevrolet Silverado 1500')).toEqual({ make: 1, model: 10, year: 2019 });
  });

  it('prefers the longest names', () => {
    expect(ids('land rover defender').make).toBe(3);
    expect(ids('silverado 1500').model).toBe(10);
  });

  it('understands nicknames and compact model names', () => {
    expect(ids('chevy silverado')).toMatchObject({ make: 1, model: 11 });
    expect(ids('ford f150')).toMatchObject({ make: 2, model: 20 });
    expect(ids('crv')).toMatchObject({ make: 4, model: 40 });
  });

  it('infers the make from a model only when the model name is unique', () => {
    expect(ids('Model 3')).toMatchObject({ make: 5, model: 50 });
    expect(ids('escape')).toEqual({ make: undefined, model: undefined, year: undefined });
  });

  it('returns nothing for unknown text', () => {
    expect(ids('something fast')).toEqual({ make: undefined, model: undefined, year: undefined });
    expect(ids('   ')).toEqual({ make: undefined, model: undefined, year: undefined });
  });
});
