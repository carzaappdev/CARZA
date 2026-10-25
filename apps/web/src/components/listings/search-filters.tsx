'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  BODY_STYLES,
  BODY_STYLE_LABELS,
  CONDITION_LABELS,
  DRIVETRAINS,
  DRIVETRAIN_LABELS,
  FUEL_TYPES,
  FUEL_TYPE_LABELS,
  LISTING_CONDITIONS,
  SEARCH_RADIUS_MILES,
  TRANSMISSIONS,
  TRANSMISSION_LABELS,
  DEFAULT_SEARCH_RADIUS_MILES,
  hasLocation,
  type SearchFilters as Filters,
} from '@carza/shared';

type Option = { slug: string; name: string };

const MILEAGE_OPTIONS = [10_000, 25_000, 50_000, 75_000, 100_000, 150_000];

const field =
  'border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none';

/**
 * The search filter form. Plain GET form to /search, so it works without JavaScript. With JS, it navigates
 * client-side, drops empty fields from the URL, and applies selects and checkboxes as soon as they change.
 */
export function SearchFilters({
  filters,
  makes,
  models,
}: {
  filters: Filters;
  makes: Option[];
  models: Option[];
}) {
  const router = useRouter();
  const lat = useRef<HTMLInputElement>(null);
  const lng = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const located = hasLocation(filters);

  function submit(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string' && value.trim() !== '') params.append(key, value.trim());
    }
    const query = params.toString();
    router.push((query ? `/search?${query}` : '/search') as Route);
  }

  function onChange(e: ChangeEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLSelectElement && target.name === 'make') {
      const model = e.currentTarget.elements.namedItem('model');
      if (model instanceof HTMLSelectElement) model.value = '';
    }
    if (
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement && target.type === 'checkbox')
    ) {
      submit(e.currentTarget);
    }
  }

  function setLocation(form: HTMLFormElement | null, coords?: { lat: number; lng: number }) {
    if (!form || !lat.current || !lng.current) return;
    // Two decimals (~1 km) is plenty for a radius search and keeps exact positions out of URLs.
    lat.current.value = coords ? coords.lat.toFixed(2) : '';
    lng.current.value = coords ? coords.lng.toFixed(2) : '';
    submit(form);
  }

  function locateMe(form: HTMLFormElement | null) {
    if (!('geolocation' in navigator)) {
      setLocationError("Your browser can't share a location.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocation(form, { lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocationError('We couldn’t get your location. Check your browser’s permission.');
      },
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 },
    );
  }

  return (
    <div>
      <button
        type="button"
        className="border-input mb-4 h-10 rounded-md border px-4 text-sm font-medium lg:hidden"
        aria-expanded={open}
        aria-controls="search-filters"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide filters' : 'Filters'}
      </button>

      <form
        id="search-filters"
        action="/search"
        method="get"
        role="search"
        aria-label="Filter cars"
        className={`${open ? 'flex' : 'hidden'} flex-col gap-5 lg:flex`}
        onChange={onChange}
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
      >
        {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
        <input ref={lat} type="hidden" name="lat" defaultValue={filters.lat} />
        <input ref={lng} type="hidden" name="lng" defaultValue={filters.lng} />

        <Section title="Location">
          {located ? (
            <div className="flex flex-col gap-2">
              <label className="sr-only" htmlFor="f-radius">
                Distance
              </label>
              <select
                id="f-radius"
                name="radius"
                defaultValue={filters.radius ?? DEFAULT_SEARCH_RADIUS_MILES}
                className={field}
              >
                {SEARCH_RADIUS_MILES.map((r) => (
                  <option key={r} value={r}>
                    Within {r} miles of you
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-muted-foreground self-start text-sm underline"
                onClick={(e) => setLocation(e.currentTarget.form)}
              >
                Search everywhere instead
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="border-input h-10 rounded-md border px-3 text-sm font-medium disabled:opacity-60"
              disabled={locating}
              onClick={(e) => locateMe(e.currentTarget.form)}
            >
              {locating ? 'Finding you…' : 'Use my location'}
            </button>
          )}
          {locationError && (
            <p role="alert" className="text-destructive text-sm">
              {locationError}
            </p>
          )}
        </Section>

        <Section title="Make and model">
          <label className="sr-only" htmlFor="f-make">
            Make
          </label>
          <select id="f-make" name="make" defaultValue={filters.make ?? ''} className={field}>
            <option value="">Any make</option>
            {makes.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="f-model">
            Model
          </label>
          <select
            id="f-model"
            name="model"
            defaultValue={filters.model ?? ''}
            className={field}
            disabled={!filters.make}
          >
            <option value="">{filters.make ? 'Any model' : 'Pick a make first'}</option>
            {models.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Price">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              name="priceMin"
              label="Min price ($)"
              value={filters.priceMin}
              max={10_000_000}
            />
            <NumberField
              name="priceMax"
              label="Max price ($)"
              value={filters.priceMax}
              max={10_000_000}
            />
          </div>
        </Section>

        <Section title="Year">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              name="yearMin"
              label="From"
              value={filters.yearMin}
              min={1900}
              max={2100}
            />
            <NumberField name="yearMax" label="To" value={filters.yearMax} min={1900} max={2100} />
          </div>
        </Section>

        <Section title="Mileage">
          <label className="sr-only" htmlFor="f-mileage">
            Maximum mileage
          </label>
          <select
            id="f-mileage"
            name="mileageMax"
            defaultValue={filters.mileageMax ?? ''}
            className={field}
          >
            <option value="">Any mileage</option>
            {MILEAGE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                Under {m.toLocaleString('en-US')} mi
              </option>
            ))}
          </select>
        </Section>

        <Section title="Condition and seller">
          <label className="sr-only" htmlFor="f-condition">
            Condition
          </label>
          <select
            id="f-condition"
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
          <label className="sr-only" htmlFor="f-seller">
            Seller
          </label>
          <select id="f-seller" name="seller" defaultValue={filters.seller ?? ''} className={field}>
            <option value="">Dealers and private sellers</option>
            <option value="dealer">Dealers only</option>
            <option value="private">Private sellers only</option>
          </select>
        </Section>

        <Checkboxes
          title="Body style"
          name="body"
          values={BODY_STYLES}
          labels={BODY_STYLE_LABELS}
          checked={filters.body}
        />
        <Checkboxes
          title="Fuel"
          name="fuel"
          values={FUEL_TYPES}
          labels={FUEL_TYPE_LABELS}
          checked={filters.fuel}
        />
        <Checkboxes
          title="Drivetrain"
          name="drive"
          values={DRIVETRAINS}
          labels={DRIVETRAIN_LABELS}
          checked={filters.drive}
        />
        <Checkboxes
          title="Transmission"
          name="trans"
          values={TRANSMISSIONS}
          labels={TRANSMISSION_LABELS}
          checked={filters.trans}
        />

        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-primary text-primary-foreground h-10 flex-1 rounded-md px-4 text-sm font-semibold"
          >
            Show cars
          </button>
          <Link
            href="/search"
            className="border-input grid h-10 place-items-center rounded-md border px-4 text-sm font-medium"
          >
            Reset
          </Link>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function NumberField({
  name,
  label,
  value,
  min = 0,
  max,
}: {
  name: string;
  label: string;
  value: number | undefined;
  min?: number;
  max: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        name={name}
        min={min}
        max={max}
        step={1}
        defaultValue={value}
        className={field}
      />
    </label>
  );
}

function Checkboxes<T extends string>({
  title,
  name,
  values,
  labels,
  checked = [],
}: {
  title: string;
  name: string;
  values: readonly T[];
  labels: Record<T, string>;
  checked?: readonly T[];
}) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {values.map((v) => (
          <label key={v} className="flex min-h-6 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={v}
              defaultChecked={checked.includes(v)}
              className="accent-primary size-4"
            />
            {labels[v]}
          </label>
        ))}
      </div>
    </Section>
  );
}
