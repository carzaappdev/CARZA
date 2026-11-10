'use client';

import { useState, type FormEvent } from 'react';
import { legalRequestSchema, type LegalRequestKind } from '@carza/shared';
import { Field, FormMessage, SubmitButton } from '@/components/auth/fields';
import { submitLegalRequest } from '@/lib/actions/legal';

const textareaClass =
  'border-input placeholder:text-muted-foreground/70 aria-invalid:border-destructive bg-background hover:border-foreground/25 focus-visible:border-foreground focus-visible:ring-foreground/10 w-full rounded-xl border px-4 py-3 text-base outline-none focus-visible:ring-4';

/**
 * The public request form behind the takedown, copyright and contact pages. Works without an account.
 * `kinds` with more than one entry shows a picker.
 */
export function LegalRequestForm({
  kinds,
  whereLabel,
  whereHint,
  statementLabel,
  statementHint,
  confirmText,
}: {
  kinds: { value: LegalRequestKind; label: string }[];
  whereLabel: string;
  whereHint: string;
  statementLabel: string;
  statementHint?: string;
  confirmText: string;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = legalRequestSchema.safeParse({
      ...Object.fromEntries(form),
      kind: form.get('kind') ?? kinds[0]?.value,
      confirmed: form.get('confirmed') === 'on',
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      return setErrors(next);
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await submitLegalRequest(parsed.data);
    setPending(false);
    if (!result.ok) return setFormError(result.error.message);
    setTicket(result.data.ticket);
  }

  if (ticket) {
    return (
      <div role="status" className="bg-muted flex flex-col gap-2 rounded-2xl p-5">
        <h2 className="font-display text-xl font-bold tracking-tight">We’ve got your request</h2>
        <p className="text-[15px]">
          Your reference is <span className="font-mono font-semibold">{ticket}</span>. Keep it:
          we’ll use it if we need to reach you at the email you gave.
        </p>
      </div>
    );
  }

  const area = (
    name: 'urls' | 'statement',
    label: string,
    hint: string | undefined,
    rows: number,
  ) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={`${name}-help`}
        className={textareaClass}
      />
      <p
        id={`${name}-help`}
        className={errors[name] ? 'text-destructive text-sm' : 'text-muted-foreground text-xs'}
      >
        {errors[name] ?? hint}
      </p>
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      {kinds.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kind" className="text-sm font-medium">
            What is this about?
          </label>
          <select
            id="kind"
            name="kind"
            className="border-input bg-background h-12 rounded-xl border px-3 text-base"
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="kind" value={kinds[0]?.value} />
      )}
      <Field label="Your full name" name="name" autoComplete="name" required error={errors.name} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
        hint="Only used to reply to this request."
      />
      {area('urls', whereLabel, whereHint, 3)}
      {area('statement', statementLabel, statementHint, 5)}
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="confirmed" className="mt-1 size-5 accent-current" />
        <span>
          {confirmText}
          {errors.confirmed ? (
            <span className="text-destructive block text-sm">{errors.confirmed}</span>
          ) : null}
        </span>
      </label>
      <Field
        label="Sign by typing your full name"
        name="signature"
        required
        error={errors.signature}
      />
      <SubmitButton pending={pending}>Send request</SubmitButton>
    </form>
  );
}
