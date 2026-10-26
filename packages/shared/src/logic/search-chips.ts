import { DEFAULT_SEARCH_RADIUS_MILES, type SearchFilters } from '../schemas/search';
import {
  BODY_STYLE_LABELS,
  CONDITION_LABELS,
  DRIVETRAIN_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from './format';

export type FilterChip = { key: string; label: string; remove: Partial<SearchFilters> };

const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;

function range(min: number | undefined, max: number | undefined, fmt: (n: number) => string) {
  if (min !== undefined && max !== undefined) return `${fmt(min)}–${fmt(max)}`;
  if (min !== undefined) return `${fmt(min)}+`;
  if (max !== undefined) return `Up to ${fmt(max)}`;
  return null;
}

/**
 * The active filters as removable chips. `remove` is the patch that clears that one filter (and anything
 * that depends on it). `names` supplies display names the URL doesn't carry.
 */
export function filterChips(
  f: SearchFilters,
  names: { make?: string; model?: string; place?: string } = {},
): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (key: string, label: string | null, remove: Partial<SearchFilters>) => {
    if (label) chips.push({ key, label, remove: { ...remove, page: undefined } });
  };

  if (f.zip !== undefined || (f.lat !== undefined && f.lng !== undefined)) {
    const radius = f.radius ?? DEFAULT_SEARCH_RADIUS_MILES;
    add('location', `Within ${radius} mi of ${names.place ?? 'you'}`, {
      zip: undefined,
      lat: undefined,
      lng: undefined,
      radius: undefined,
      sort: f.sort === 'distance' ? undefined : f.sort,
    });
  }
  if (names.make) add('make', names.make, { make: undefined, model: undefined });
  if (names.model) add('model', names.model, { model: undefined });
  add('price', range(f.priceMin, f.priceMax, dollars), {
    priceMin: undefined,
    priceMax: undefined,
  });
  add('year', range(f.yearMin, f.yearMax, String), { yearMin: undefined, yearMax: undefined });
  if (f.mileageMax !== undefined) {
    add('mileage', `Under ${f.mileageMax.toLocaleString('en-US')} mi`, { mileageMax: undefined });
  }
  if (f.condition) add('condition', CONDITION_LABELS[f.condition], { condition: undefined });
  if (f.seller) {
    add('seller', f.seller === 'dealer' ? 'Dealers only' : 'Private sellers only', {
      seller: undefined,
    });
  }
  const lists = [
    ['body', f.body, BODY_STYLE_LABELS],
    ['fuel', f.fuel, FUEL_TYPE_LABELS],
    ['drive', f.drive, DRIVETRAIN_LABELS],
    ['trans', f.trans, TRANSMISSION_LABELS],
  ] as const;
  for (const [key, values, labels] of lists) {
    for (const v of values ?? []) {
      const rest = (values as readonly string[]).filter((x) => x !== v);
      add(`${key}-${v}`, (labels as Record<string, string>)[v] ?? v, {
        [key]: rest.length ? rest : undefined,
      });
    }
  }
  return chips;
}
