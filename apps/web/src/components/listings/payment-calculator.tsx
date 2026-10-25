'use client';

import { useId, useState } from 'react';
import {
  LOAN_TERM_MONTHS,
  defaultLoanTerms,
  formatPrice,
  monthlyPaymentCents,
} from '@carza/shared';

const field =
  'border-input bg-background focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-[3px]';

/** Monthly payment estimate the buyer can tune: down payment, term and APR. */
export function PaymentCalculator({ priceCents, isNew }: { priceCents: number; isNew: boolean }) {
  const id = useId();
  const defaults = defaultLoanTerms(priceCents, isNew);
  const [down, setDown] = useState(String(defaults.downPaymentCents / 100));
  const [apr, setApr] = useState(String(defaults.aprPercent));
  const [months, setMonths] = useState<number>(defaults.months);

  const terms = {
    downPaymentCents: Math.max(0, Math.round((Number(down) || 0) * 100)),
    aprPercent: Math.min(40, Math.max(0, Number(apr) || 0)),
    months,
  };
  const monthly = monthlyPaymentCents(priceCents, terms);
  const financed = Math.max(0, priceCents - terms.downPaymentCents);
  const interest = Math.max(0, monthly * months - financed);

  return (
    <div className="flex flex-col gap-4">
      <p>
        <span className="font-display text-3xl font-extrabold">{formatPrice(monthly)}</span>
        <span className="text-muted-foreground">/mo</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium" htmlFor={`${id}-down`}>
          Down payment
          <span className="relative">
            <span
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
            >
              $
            </span>
            <input
              id={`${id}-down`}
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              value={down}
              onChange={(e) => setDown(e.target.value)}
              className={`${field} pl-6`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" htmlFor={`${id}-term`}>
          Term
          <select
            id={`${id}-term`}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className={field}
          >
            {LOAN_TERM_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m} mo
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" htmlFor={`${id}-apr`}>
          APR
          <span className="relative">
            <input
              id={`${id}-apr`}
              type="number"
              inputMode="decimal"
              min={0}
              max={40}
              step={0.1}
              value={apr}
              onChange={(e) => setApr(e.target.value)}
              className={`${field} pr-7`}
            />
            <span
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm"
            >
              %
            </span>
          </span>
        </label>
      </div>
      <dl className="text-muted-foreground grid grid-cols-2 gap-1 text-sm">
        <dt>Amount financed</dt>
        <dd className="text-foreground text-right font-medium">{formatPrice(financed)}</dd>
        <dt>Total interest</dt>
        <dd className="text-foreground text-right font-medium">{formatPrice(interest)}</dd>
      </dl>
      <p className="text-muted-foreground text-xs">
        An estimate, not a loan offer. Excludes taxes, title and fees. Your rate depends on your
        credit.
      </p>
    </div>
  );
}
