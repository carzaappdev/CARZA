'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { ChevronDownIcon, LocateFixedIcon } from 'lucide-react';
import {
  BODY_STYLES,
  BODY_STYLE_LABELS,
  CONDITION_LABELS,
  DEFAULT_SEARCH_RADIUS_MILES,
  DRIVETRAINS,
  DRIVETRAIN_LABELS,
  FUEL_TYPES,
  FUEL_TYPE_LABELS,
  LISTING_CONDITIONS,
  SEARCH_RADIUS_MILES,
  TRANSMISSIONS,
  TRANSMISSION_LABELS,
  type SearchFilters as Filters,
  ZIP_CODE,
} from '@carza/shared';
import { Button } from '@/components/ui/button';
import { ZIP_COOKIE } from '@/lib/search';
import { cn } from '@/lib/utils';

type Option = { slug: string; name: string };

const MILEAGE_OPTIONS = [10_000, 25_000, 50_000, 75_000, 100_000, 150_000];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR + 2 - 1990 }, (_, i) => THIS_YEAR + 1 - i);

const field =
  'border-input bg-background focus-visible:ring-ring/50 h-11 w-full min-w-0 rounded-lg border px-3 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50';

/**
 * The search filter form. A plain GET form to /search, so it works without JavaScript. With JS it
 * navigates client-side and keeps empty fields out of the URL. With `autoApply` (the desktop sidebar),
 * selects and checkboxes apply as soon as they change; in the phone sheet the buyer taps "Show cars".
 */
export function SearchFilters({
  filters,
  makes,
  models,
  autoApply,
  idPrefix,
  onApplied,
}: {
  filters: Filters;
  makes: Option[];
  models: Option[];
  autoApply: boolean;
  idPrefix: string;
  onApplied?: () => void;
}) {
  const router = useRouter();
  const lat = useRef<HTMLInputElement>(null);
  const lng = useRef<HTMLInputElement>(null);
  const zip = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const id = (name: string) => `${idPrefix}-${name}`;
  const usingDevice = filters.lat !== undefined && filters.lng !== undefined && !filters.zip;

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const zipValue = String(data.get('zip') ?? '').trim();
    // One location at a time: a typed ZIP replaces "my location".
    if (zipValue) {
      data.delete('lat');
      data.delete('lng');
    }
    // Remember a valid ZIP for the home page and the header search; forget it when the buyer clears it.
    if (!zipValue || ZIP_CODE.test(zipValue)) {
      const secure = location.protocol === 'https:' ? '; secure' : '';
      const maxAge = zipValue ? 31536000 : 0;
      document.cookie = `${ZIP_COOKIE}=${zipValue}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
    }
    if (!zipValue && !data.get('lat')) {
      data.delete('radius');
      if (data.get('sort') === 'distance') data.delete('sort');
    }
    const params = new URLSearchParams();
    for (const [key, value] of data) {
      if (typeof value === 'string' && value.trim() !== '') params.append(key, value.trim());
    }
    const query = params.toString();
    router.push((query ? `/search?${query}` : '/search') as Route, { scroll: false });
    onApplied?.();
  }

  function onChange(e: ChangeEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLSelectElement && target.name === 'make') {
      const model = e.currentTarget.elements.namedItem('model');
      if (model instanceof HTMLSelectElement) model.value = '';
    }
    const instant =
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement && target.type === 'checkbox');
    if (autoApply && instant) submit(e.currentTarget);
  }

  function locateMe(form: HTMLFormElement | null) {
    if (!form || !('geolocation' in navigator)) {
      setLocationError('Your browser can’t share a location. Enter a ZIP code instead.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        if (!lat.current || !lng.current || !zip.current) return;
        // Two decimals (~1 km) is plenty for a radius search and keeps exact positions out of URLs.
        lat.current.value = coords.latitude.toFixed(2);
        lng.current.value = coords.longitude.toFixed(2);
        zip.current.value = '';
        submit(form);
      },
      () => {
        setLocating(false);
        setLocationError('We couldn’t get your location. Enter a ZIP code instead.');
      },
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 },
    );
  }

  const open = (...active: unknown[]) => active.some((v) => v !== undefined);

  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="Filter cars"
      className="flex flex-col"
      onChange={onChange}
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
      <input ref={lat} type="hidden" name="lat" defaultValue={usingDevice ? filters.lat : ''} />
      <input ref={lng} type="hidden" name="lng" defaultValue={usingDevice ? filters.lng : ''} />

      <Group title="Location" defaultOpen>
        <div className="flex gap-2">
          <label htmlFor={id('zip')} className="sr-only">
            ZIP code
          </label>
          <input
            ref={zip}
            id={id('zip')}
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[0-9]{5}"
            maxLength={5}
            placeholder={usingDevice ? 'Your location' : 'ZIP code'}
            defaultValue={filters.zip}
            className={field}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-lg"
            disabled={locating}
            aria-label="Use my location"
            title="Use my location"
            onClick={(e) => locateMe(e.currentTarget.form)}
          >
            <LocateFixedIcon className={cn(locating && 'animate-pulse')} />
          </Button>
        </div>
        <label htmlFor={id('radius')} className="sr-only">
          Distance
        </label>
        <select
          id={id('radius')}
          name="radius"
          defaultValue={filters.radius ?? DEFAULT_SEARCH_RADIUS_MILES}
          className={field}
        >
          {SEARCH_RADIUS_MILES.map((r) => (
            <option key={r} value={r}>
              Within {r} miles
            </option>
          ))}
        </select>
        {locationError && (
          <p role="alert" className="text-destructive text-sm">
            {locationError}
          </p>
        )}
      </Group>

      <Group title="Make and model" defaultOpen>
        <label className="sr-only" htmlFor={id('make')}>
          Make
        </label>
        <select id={id('make')} name="make" defaultValue={filters.make ?? ''} className={field}>
          <option value="">All makes</option>
          {makes.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={id('model')}>
          Model
        </label>
        <select
          id={id('model')}
          name="model"
          defaultValue={filters.model ?? ''}
          className={field}
          disabled={!filters.make}
        >
          <option value="">{filters.make ? 'All models' : 'Choose a make first'}</option>
          {models.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
      </Group>

      <Group title="Price" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <DollarField id={id('price-min')} name="priceMin" label="Min" value={filters.priceMin} />
          <DollarField id={id('price-max')} name="priceMax" label="Max" value={filters.priceMax} />
        </div>
        {!autoApply ? null : (
          <Button type="submit" variant="secondary" size="sm" className="self-start">
            Apply price
          </Button>
        )}
      </Group>

      <Group title="Year" defaultOpen={open(filters.yearMin, filters.yearMax)}>
        <div className="grid grid-cols-2 gap-2">
          <YearSelect id={id('year-min')} name="yearMin" label="From" value={filters.yearMin} />
          <YearSelect id={id('year-max')} name="yearMax" label="To" value={filters.yearMax} />
        </div>
      </Group>

      <Group title="Mileage" defaultOpen={open(filters.mileageMax)}>
        <label className="sr-only" htmlFor={id('mileage')}>
          Maximum mileage
        </label>
        <select
          id={id('mileage')}
          name="mileageMax"
          defaultValue={filters.mileageMax ?? ''}
          className={field}
        >
          <option value="">Any mileage</option>
          {MILEAGE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              Under {m.toLocaleString('en-US')} miles
            </option>
          ))}
        </select>
      </Group>

      <Group title="Body style" defaultOpen>
        <Checkboxes
          name="body"
          values={BODY_STYLES}
          labels={BODY_STYLE_LABELS}
          checked={filters.body}
        />
      </Group>

      <Group title="Condition and seller" defaultOpen={open(filters.condition, filters.seller)}>
        <label className="sr-only" htmlFor={id('condition')}>
          Condition
        </label>
        <select
          id={id('condition')}
          name="condition"
          defaultValue={filters.condition ?? ''}
          className={field}
        >
          <option value="">New and used</option>
          {LISTING_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {CONDITION_LABELS[c]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={id('seller')}>
          Seller
        </label>
        <select
          id={id('seller')}
          name="seller"
          defaultValue={filters.seller ?? ''}
          className={field}
        >
          <option value="">Dealers and private sellers</option>
          <option value="dealer">Dealers only</option>
          <option value="private">Private sellers only</option>
        </select>
      </Group>

      <Group title="Fuel" defaultOpen={open(filters.fuel)}>
        <Checkboxes
          name="fuel"
          values={FUEL_TYPES}
          labels={FUEL_TYPE_LABELS}
          checked={filters.fuel}
        />
      </Group>
      <Group title="Drivetrain" defaultOpen={open(filters.drive)}>
        <Checkboxes
          name="drive"
          values={DRIVETRAINS}
          labels={DRIVETRAIN_LABELS}
          checked={filters.drive}
        />
      </Group>
      <Group title="Transmission" defaultOpen={open(filters.trans)}>
        <Checkboxes
          name="trans"
          values={TRANSMISSIONS}
          labels={TRANSMISSION_LABELS}
          checked={filters.trans}
        />
      </Group>

      <div
        className={cn(
          'bg-background flex gap-2 pt-4',
          !autoApply && 'sticky bottom-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]',
        )}
      >
        <Button type="submit" size="lg" className="flex-1">
          Show cars
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/search" onClick={onApplied}>
            Reset
          </Link>
        </Button>
      </div>
    </form>
  );
}

/** A collapsible filter group. Native <details>: keyboard and screen-reader friendly, no JS needed. */
function Group({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group/filter border-b py-1 last-of-type:border-b-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon
          aria-hidden
          className="text-muted-foreground size-4 transition-transform group-open/filter:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-2 pb-4">{children}</div>
    </details>
  );
}

function DollarField({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label} price
      </label>
      <span
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
      >
        $
      </span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        name={name}
        min={0}
        max={10_000_000}
        step={500}
        placeholder={label}
        defaultValue={value}
        className={cn(field, 'pl-6')}
      />
    </div>
  );
}

function YearSelect({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: number | undefined;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Year {label.toLowerCase()}
      </label>
      <select id={id} name={name} defaultValue={value ?? ''} className={field}>
        <option value="">{label}</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checkboxes<T extends string>({
  name,
  values,
  labels,
  checked = [],
}: {
  name: string;
  values: readonly T[];
  labels: Record<T, string>;
  checked?: readonly T[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <label key={v} className="relative">
          <input
            type="checkbox"
            name={name}
            value={v}
            defaultChecked={checked.includes(v)}
            className="peer sr-only"
          />
          <span className="peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary peer-focus-visible:ring-ring/50 hover:bg-accent inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-sm transition-colors peer-focus-visible:ring-[3px]">
            {labels[v]}
          </span>
        </label>
      ))}
    </div>
  );
}
