// Buyer-facing money math: estimated monthly payments and how a price compares with the market.

export type LoanTerms = { downPaymentCents: number; aprPercent: number; months: number };

export const LOAN_TERM_MONTHS = [36, 48, 60, 72, 84] as const;

/** What the card estimate assumes: 10% down, 60 months, and a typical APR for new or used. */
export function defaultLoanTerms(priceCents: number, isNew: boolean): LoanTerms {
  return {
    downPaymentCents: Math.round((priceCents * 0.1) / 100) * 100,
    aprPercent: isNew ? 6.5 : 8.5,
    months: 60,
  };
}

/** Monthly payment in cents for a simple amortized loan. Taxes and fees not included. */
export function monthlyPaymentCents(priceCents: number, terms: LoanTerms) {
  const principal = Math.max(0, priceCents - terms.downPaymentCents);
  const months = Math.max(1, Math.round(terms.months));
  const r = Math.max(0, terms.aprPercent) / 100 / 12;
  if (principal === 0) return 0;
  if (r === 0) return Math.round(principal / months);
  return Math.round((principal * r) / (1 - (1 + r) ** -months));
}

export const PRICE_RATINGS = ['great', 'good', 'fair', 'high', 'overpriced'] as const;
export type PriceRating = (typeof PRICE_RATINGS)[number];

export const PRICE_RATING_LABELS: Record<PriceRating, string> = {
  great: 'Great price',
  good: 'Good price',
  fair: 'Fair price',
  high: 'High price',
  overpriced: 'Overpriced',
};

/**
 * How an asking price compares with the estimated market price of similar cars. `differenceCents` is
 * positive when the car is priced below the market.
 */
export function priceRating(priceCents: number, marketPriceCents: number) {
  const ratio = priceCents / marketPriceCents;
  const rating: PriceRating =
    ratio <= 0.92
      ? 'great'
      : ratio <= 0.97
        ? 'good'
        : ratio <= 1.03
          ? 'fair'
          : ratio <= 1.1
            ? 'high'
            : 'overpriced';
  return { rating, differenceCents: marketPriceCents - priceCents };
}
