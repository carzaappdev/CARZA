import { TrendingDownIcon, TrendingUpIcon, MinusIcon } from 'lucide-react';
import { PRICE_RATING_LABELS, priceRating, type PriceRating } from '@carza/shared';
import { cn } from '@/lib/utils';

const STYLES: Record<PriceRating, string> = {
  great: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  good: 'bg-green-100 text-green-900 dark:bg-green-500/15 dark:text-green-200',
  fair: 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200',
  high: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  overpriced: 'bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200',
};

const ICONS = {
  great: TrendingDownIcon,
  good: TrendingDownIcon,
  fair: MinusIcon,
  high: TrendingUpIcon,
  overpriced: TrendingUpIcon,
} as const;

/** "Great price" etc., from the asking price vs. the estimated market price of similar cars. */
export function PriceRatingBadge({
  priceCents,
  marketPriceCents,
  className,
}: {
  priceCents: number;
  marketPriceCents: number;
  className?: string;
}) {
  const { rating } = priceRating(priceCents, marketPriceCents);
  const Icon = ICONS[rating];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        STYLES[rating],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {PRICE_RATING_LABELS[rating]}
    </span>
  );
}
