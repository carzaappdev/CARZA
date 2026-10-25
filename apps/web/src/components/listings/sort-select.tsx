'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  SEARCH_SORTS,
  SORT_LABELS,
  hasLocation,
  toSearchQuery,
  type SearchFilters,
  type SearchSort,
} from '@carza/shared';

export function SortSelect({ filters }: { filters: SearchFilters }) {
  const router = useRouter();
  const sorts = SEARCH_SORTS.filter((s) => s !== 'distance' || hasLocation(filters));
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort</span>
      <select
        value={filters.sort ?? 'newest'}
        className="border-input bg-background h-10 rounded-md border px-2 text-sm"
        onChange={(e) => {
          const query = toSearchQuery(filters, {
            sort: e.target.value as SearchSort,
            page: undefined,
          });
          router.push(`/search${query ? `?${query}` : ''}` as Route);
        }}
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
