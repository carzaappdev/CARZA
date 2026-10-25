'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  SEARCH_SORTS,
  SORT_LABELS,
  searchHref,
  type SearchFilters,
  type SearchSort,
} from '@carza/shared';

export function SortSelect({ filters, located }: { filters: SearchFilters; located: boolean }) {
  const router = useRouter();
  const sorts = SEARCH_SORTS.filter((s) => s !== 'distance' || located);
  return (
    <label className="ml-auto flex items-center gap-2 text-sm">
      <span className="text-muted-foreground hidden sm:inline">Sort by</span>
      <select
        value={filters.sort ?? 'newest'}
        aria-label="Sort by"
        className="border-input bg-background focus-visible:ring-ring/50 h-10 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-[3px]"
        onChange={(e) =>
          router.push(
            searchHref(filters, { sort: e.target.value as SearchSort, page: undefined }) as Route,
            { scroll: false },
          )
        }
      >
        {sorts.map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
