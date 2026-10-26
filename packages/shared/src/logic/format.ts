import type {
  BodyStyle,
  Drivetrain,
  FuelType,
  ListingCondition,
  Transmission,
} from '../constants/enums';
import type { SearchSort } from '../schemas/search';
import { metersToMiles } from './geo';

// One market for now (USD, miles, US English). Kept in one place so a second market is a small change.
const LOCALE = 'en-US';
const priceFormat = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const numberFormat = new Intl.NumberFormat(LOCALE);

export const formatPrice = (cents: number) => priceFormat.format(Math.round(cents / 100));
export const formatMileage = (miles: number) => `${numberFormat.format(miles)} mi`;

/** "<1 mi", "12 mi". */
export function formatDistance(meters: number) {
  const miles = metersToMiles(meters);
  return miles < 1 ? '<1 mi' : `${numberFormat.format(Math.round(miles))} mi`;
}

/** "2019 Toyota Tacoma TRD Off-Road" */
export function vehicleTitle(v: {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
}) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');
}

export const BODY_STYLE_LABELS: Record<BodyStyle, string> = {
  sedan: 'Sedan',
  coupe: 'Coupe',
  hatchback: 'Hatchback',
  wagon: 'Wagon',
  convertible: 'Convertible',
  suv: 'SUV',
  crossover: 'Crossover',
  pickup: 'Pickup truck',
  minivan: 'Minivan',
  van: 'Van',
  other: 'Other',
};

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  gasoline: 'Gas',
  diesel: 'Diesel',
  hybrid: 'Hybrid',
  plug_in_hybrid: 'Plug-in hybrid',
  electric: 'Electric',
  flex: 'Flex fuel',
  other: 'Other',
};

export const DRIVETRAIN_LABELS: Record<Drivetrain, string> = {
  fwd: 'Front-wheel drive',
  rwd: 'Rear-wheel drive',
  awd: 'All-wheel drive',
  '4wd': 'Four-wheel drive',
};

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  automatic: 'Automatic',
  manual: 'Manual',
  cvt: 'CVT',
  dct: 'Dual-clutch',
};

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'New',
  used: 'Used',
  certified: 'Certified pre-owned',
};

export const SORT_LABELS: Record<SearchSort, string> = {
  newest: 'Newest listings',
  price_asc: 'Lowest price',
  price_desc: 'Highest price',
  mileage_asc: 'Lowest mileage',
  year_desc: 'Newest year',
  distance: 'Closest first',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Listed today", "Listed 3 days ago", "Listed 2 weeks ago", "Listed 4 months ago". */
export function listedAgo(publishedAt: string | Date, now: Date = new Date()) {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(publishedAt).getTime()) / DAY_MS));
  if (days === 0) return 'Listed today';
  if (days === 1) return 'Listed yesterday';
  if (days < 14) return `Listed ${days} days ago`;
  if (days < 60) return `Listed ${Math.floor(days / 7)} weeks ago`;
  return `Listed ${Math.floor(days / 30)} months ago`;
}
