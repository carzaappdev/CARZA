'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { setBirthDateSchema } from '@carza/shared';
import { setBirthDate } from '@/lib/actions/age';
import { blockAge, useAgeBlocked } from '@/lib/age-block';
import { AgeBlocked } from './age-blocked';
import { Field, FormMessage, SubmitButton } from './fields';

/** One-time date-of-birth step for accounts that don't have one (Google/Apple sign-ins, older accounts). */
export function AgeForm() {
  const router = useRouter();
  const blocked = useAgeBlocked();
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (blocked) return <AgeBlocked />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = setBirthDateSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) return setError('Enter your date of birth.');
    setError(null);
    setFormError(null);
    setPending(true);
    const result = await setBirthDate(parsed.data);
    setPending(false);
    if (!result.ok) return setFormError(result.error.message);
    if (result.data.underAge) return blockAge();
    router.replace('/welcome');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">When were you born?</h1>
        <p className="text-muted-foreground text-sm">
          We ask everyone once. Your date of birth is private and never shown on your profile.
        </p>
      </div>
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="Date of birth"
        name="birthDate"
        type="date"
        autoComplete="bday"
        required
        error={error ?? undefined}
      />
      <SubmitButton pending={pending}>Continue</SubmitButton>
    </form>
  );
}
