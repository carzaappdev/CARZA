/** Categories shared by mods and parts. Matches the `part_category` enum. */
export const PART_CATEGORIES = [
  'tuning',
  'engine',
  'intake_exhaust',
  'suspension',
  'wheels_tires',
  'brakes',
  'exterior',
  'lighting',
  'interior',
  'electronics',
  'care',
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  tuning: 'Tuning',
  engine: 'Engine',
  intake_exhaust: 'Intake & exhaust',
  suspension: 'Suspension',
  wheels_tires: 'Wheels & tires',
  brakes: 'Brakes',
  exterior: 'Exterior',
  lighting: 'Lighting',
  interior: 'Interior',
  electronics: 'Electronics',
  care: 'Care & detailing',
};

export type CarName = { year: number; make: string; model: string; trimLevel?: string | null };

/** "2019 Mazda MX-5 Miata Club" */
export function carTitle(car: CarName) {
  return [car.year, car.make, car.model, car.trimLevel].filter(Boolean).join(' ');
}

// Model words too generic to stand alone as a tag ("Grand Cherokee" shouldn't pull in #grand).
const GENERIC_WORDS = new Set([
  'grand',
  'model',
  'series',
  'sport',
  'cross',
  'super',
  'duty',
  'prime',
  'electric',
  'hybrid',
  'city',
]);

/**
 * #tags people would use for a car, e.g. Mazda MX-5 Miata → ["mx5miata", "mazdamx5miata", "miata"],
 * Toyota 86 → ["toyota86"]. Only valid tags (see rich-text.ts): a letter first, 2–30 characters.
 */
export function carTags(make: string, model: string) {
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const words = model.split(/\s+/).length > 1 ? model.split(/\s+/).map(squash) : [];
  const tags = [
    squash(model),
    squash(make + model),
    ...words.filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w)),
  ];
  return [...new Set(tags)].filter((t) => /^[a-z][a-z0-9_]{1,29}$/.test(t));
}

/** A shopping search for `query` on the given car. Carza doesn't sell parts; this finds prices. */
export function partSearchUrl(car: CarName, query: string) {
  const q = `${carTitle(car)} ${query}`;
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`;
}

/** Parts every car wears out or needs (gas or electric), offered as one-tap searches for the exact car. */
export const EVERYDAY_PARTS = [
  'Brake pads',
  'Tires',
  'Wiper blades',
  'Cabin air filter',
  'Headlight bulbs',
  'Floor mats',
  'Car cover',
] as const;
