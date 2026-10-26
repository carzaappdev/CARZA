import { describe, expect, it } from 'vitest';
import { defaultLoanTerms, monthlyPaymentCents, priceRating } from './pricing';

describe('monthlyPaymentCents', () => {
  it('amortizes a standard loan', () => {
    // $20,000 financed at 6% for 60 months ≈ $386.66/mo.
    expect(
      monthlyPaymentCents(2_200_000, { downPaymentCents: 200_000, aprPercent: 6, months: 60 }),
    ).toBe(38666);
  });

  it('handles 0% APR and a down payment that covers the price', () => {
    expect(monthlyPaymentCents(1_200_000, { downPaymentCents: 0, aprPercent: 0, months: 48 })).toBe(
      25000,
    );
    expect(
      monthlyPaymentCents(1_000_000, { downPaymentCents: 2_000_000, aprPercent: 7, months: 60 }),
    ).toBe(0);
  });

  it('defaults to 10% down over 60 months', () => {
    expect(defaultLoanTerms(3_000_000, false)).toEqual({
      downPaymentCents: 300_000,
      aprPercent: 8.5,
      months: 60,
    });
  });
});

describe('priceRating', () => {
  it('rates against the market price', () => {
    expect(priceRating(900_000, 1_000_000)).toEqual({ rating: 'great', differenceCents: 100_000 });
    expect(priceRating(960_000, 1_000_000).rating).toBe('good');
    expect(priceRating(1_000_000, 1_000_000).rating).toBe('fair');
    expect(priceRating(1_080_000, 1_000_000).rating).toBe('high');
    expect(priceRating(1_200_000, 1_000_000)).toEqual({
      rating: 'overpriced',
      differenceCents: -200_000,
    });
  });
});
