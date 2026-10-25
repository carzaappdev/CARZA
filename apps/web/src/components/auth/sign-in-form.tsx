'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authErrorMessage, fieldErrors, signInSchema } from '@carza/shared';
import { createClient } from '@/lib/supabase/browser';
import { Field, FormMessage, SubmitButton } from './fields';

export function SignInForm({ next, initialError }: { next: string; initialError: string | null }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signInSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError(null);
    setPending(true);

    const { error } = await createClient().auth.signInWithPassword(parsed.data);
    if (error) {
      setFormError(authErrorMessage(error.code));
      setPending(false);
      return;
    }
    // `next` was validated by safeNextPath on the server (same-origin path); typed routes can't know that.
    router.replace(next as Route);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
      <Link
        href="/reset-password"
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
