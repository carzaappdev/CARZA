'use client';

import { useMemo, useState, useTransition } from 'react';
import { CheckIcon, ExternalLinkIcon, PlusIcon, SearchIcon, WrenchIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { GarageMod, MatchedPart } from '@carza/db';
import {
  EVERYDAY_PARTS,
  GARAGE_MAX_MODS,
  PART_CATEGORIES,
  PART_CATEGORY_LABELS,
  partSearchUrl,
  type CarName,
  type PartCategory,
} from '@carza/shared';
import { Button } from '@/components/ui/button';
import { addGarageMod, removeGarageMod } from '@/lib/actions/garage';
import { cn } from '@/lib/utils';
import { CategoryIcon } from './category-icon';

const fieldClass =
  'bg-background focus-visible:ring-ring/50 h-11 rounded-lg border px-3 text-[15px] outline-none focus-visible:ring-[3px]';

const chipClass =
  'focus-visible:ring-ring/50 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium outline-none focus-visible:ring-[3px]';

const partKey = (p: { brand: string; name: string }) => `${p.brand} ${p.name}`.toLowerCase();

/**
 * A car's build list and the parts that fit it. One component so "I have this" on a part shows up in
 * the build straight away, and a mod added by hand marks the matching part as installed.
 */
export function CarBuild({
  carId,
  car,
  mods: initialMods,
  parts,
  isOwner,
}: {
  carId: string;
  car: CarName;
  mods: GarageMod[];
  parts: MatchedPart[];
  isOwner: boolean;
}) {
  const [mods, setMods] = useState(initialMods);
  const [pending, startTransition] = useTransition();

  function add(category: PartCategory, name: string, onDone?: () => void) {
    startTransition(async () => {
      const result = await addGarageMod({ carId, category, name });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setMods((all) => [...all, result.data]);
      onDone?.();
    });
  }

  function remove(mod: GarageMod) {
    startTransition(async () => {
      const result = await removeGarageMod({ modId: mod.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setMods((all) => all.filter((m) => m.id !== mod.id));
    });
  }

  return (
    <>
      <BuildList mods={mods} isOwner={isOwner} pending={pending} onAdd={add} onRemove={remove} />
      <PartsMatch
        car={car}
        parts={parts}
        installed={new Set(mods.map((m) => m.name.toLowerCase()))}
        canAdd={isOwner && mods.length < GARAGE_MAX_MODS}
        pending={pending}
        onAdd={(p) =>
          add(p.category, `${p.brand} ${p.name}`, () => toast.success('Added to your build'))
        }
      />
    </>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t px-4 py-6">
      <div>
        <h2 id={id} className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle ? <p className="text-muted-foreground text-sm">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function BuildList({
  mods,
  isOwner,
  pending,
  onAdd,
  onRemove,
}: {
  mods: GarageMod[];
  isOwner: boolean;
  pending: boolean;
  onAdd: (category: PartCategory, name: string, onDone?: () => void) => void;
  onRemove: (mod: GarageMod) => void;
}) {
  const [category, setCategory] = useState<PartCategory | ''>('');
  const [name, setName] = useState('');
  const groups = useMemo(
    () =>
      PART_CATEGORIES.map((c) => ({
        category: c,
        mods: mods.filter((m) => m.category === c),
      })).filter((g) => g.mods.length),
    [mods],
  );

  if (!isOwner && !mods.length) return null;

  return (
    <Section
      id="build"
      title="The build"
      subtitle={
        mods.length
          ? `${mods.length} ${mods.length === 1 ? 'mod' : 'mods'}`
          : 'Stock for now. Track every mod you make here.'
      }
    >
      {groups.length ? (
        <ul className="flex flex-col gap-4">
          {groups.map((g) => (
            <li key={g.category} className="flex gap-3">
              <CategoryIcon category={g.category} />
              <div className="min-w-0 flex-1">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {PART_CATEGORY_LABELS[g.category]}
                </h3>
                <ul className="mt-1 flex flex-col">
                  {g.mods.map((m) => (
                    <li key={m.id} className="flex min-h-9 items-center gap-2 text-[15px]">
                      <span className="min-w-0 flex-1 break-words">{m.name}</span>
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => onRemove(m)}
                          disabled={pending}
                          aria-label={`Remove ${m.name}`}
                          className="text-muted-foreground hover:text-destructive hover:bg-accent focus-visible:ring-ring/50 -mr-2 grid size-9 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
                        >
                          <XIcon className="size-4" aria-hidden />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isOwner && mods.length < GARAGE_MAX_MODS ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!category) return;
            onAdd(category, name, () => {
              setName('');
              setCategory('');
            });
          }}
        >
          <label className="sr-only" htmlFor="mod-category">
            Category
          </label>
          <select
            id="mod-category"
            required
            className={cn(fieldClass, 'sm:w-48')}
            value={category}
            onChange={(e) => setCategory(e.target.value as PartCategory | '')}
          >
            <option value="">Category</option>
            {PART_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PART_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="mod-name">
            Mod
          </label>
          <input
            id="mod-name"
            required
            className={cn(fieldClass, 'min-w-0 flex-1')}
            value={name}
            maxLength={80}
            placeholder="Coilovers, cat-back, tint…"
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            className="h-11 rounded-full"
            disabled={pending || !category || !name.trim()}
          >
            <PlusIcon /> Add mod
          </Button>
        </form>
      ) : null}
    </Section>
  );
}

function fitLabel(fit: MatchedPart['fit'], car: CarName) {
  if (fit === 'model') return `Made for the ${car.model}`;
  if (fit === 'make') return `Fits ${car.make}`;
  return 'Fits any car';
}

function PartsMatch({
  car,
  parts,
  installed,
  canAdd,
  pending,
  onAdd,
}: {
  car: CarName;
  parts: MatchedPart[];
  installed: Set<string>;
  canAdd: boolean;
  pending: boolean;
  onAdd: (part: MatchedPart) => void;
}) {
  const [filter, setFilter] = useState<PartCategory | 'all'>('all');
  const categories = PART_CATEGORIES.filter((c) => parts.some((p) => p.category === c));
  const shown = filter === 'all' ? parts : parts.filter((p) => p.category === filter);
  const specific = parts.filter((p) => p.fit !== 'universal').length;

  return (
    <Section
      id="parts"
      title="Parts that fit"
      subtitle={
        specific
          ? `${specific} picked for the ${car.year} ${car.make} ${car.model}, plus essentials for any car.`
          : `Essentials that fit the ${car.year} ${car.model}. More model-specific parts are on the way.`
      }
    >
      {categories.length > 1 ? (
        <div
          role="group"
          aria-label="Filter parts"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        >
          {(['all', ...categories] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={cn(
                chipClass,
                filter === c
                  ? 'bg-foreground text-background border-foreground'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground',
              )}
            >
              {c === 'all' ? 'All' : PART_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((p) => {
          const have = installed.has(partKey(p));
          return (
            <li key={p.id} className="bg-card flex flex-col gap-3 rounded-2xl border p-4">
              <div className="flex gap-3">
                <CategoryIcon category={p.category} />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {p.brand}
                  </p>
                  <h3 className="leading-snug font-semibold">{p.name}</h3>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.blurb}</p>
              <span
                className={cn(
                  'w-fit rounded-full px-2.5 py-1 text-xs font-semibold',
                  p.fit === 'model'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {fitLabel(p.fit, car)}
              </span>
              <div className="mt-auto flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1 rounded-full">
                  <a
                    href={partSearchUrl(car, `${p.brand} ${p.name}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Find prices <ExternalLinkIcon aria-hidden />
                  </a>
                </Button>
                {have ? (
                  <span className="text-muted-foreground inline-flex h-8 items-center gap-1 px-2 text-sm font-medium">
                    <CheckIcon className="size-4" aria-hidden /> In the build
                  </span>
                ) : canAdd ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    disabled={pending}
                    onClick={() => onAdd(p)}
                  >
                    <WrenchIcon /> I have this
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 pt-2">
        <h3 className="text-sm font-semibold">Everyday parts for this car</h3>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {EVERYDAY_PARTS.map((q) => (
            <a
              key={q}
              href={partSearchUrl(car, q)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(chipClass, 'hover:bg-accent')}
            >
              <SearchIcon className="text-muted-foreground size-3.5" aria-hidden />
              {q}
            </a>
          ))}
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Carza doesn’t sell parts. Links search stores for your exact car; check the part number
          for your trim and engine before you buy.
        </p>
      </div>
    </Section>
  );
}
