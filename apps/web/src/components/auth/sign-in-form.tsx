'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authErrorMessage, fieldErrors, signInSchema } from '@carza/shared';
import { createClient } from '@/lib/supabase/browser';
import { Field, FormMessage, SubmitButton, useFocusFirstInvalid } from './fields';

export function SignInForm({ next, initialError }: { next: string; initialError: string | null }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useFocusFirstInvalid(errors);
  const [formError, setFormError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function resendConfirmation() {
    if (!unconfirmedEmail) return;
    const { error } = await createClient().auth.resend({ type: 'signup', email: unconfirmedEmail });
    if (error) return setFormError(authErrorMessage(error.code));
    setResent(true);
  }

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
      setUnconfirmedEmail(error.code === 'email_not_confirmed' ? parsed.data.email : null);
      setResent(false);
      setPending(false);
      return;
    }
    // `next` was validated by safeNextPath on the server (same-origin path); typed routes can't know that.
    router.replace(next as Route);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      {unconfirmedEmail ? (
        resent ? (
          <FormMessage tone="success">We&apos;ve sent a new confirmation link.</FormMessage>
        ) : (
          <button
            type="button"
            onClick={resendConfirmation}
            className="text-foreground font-semibold underline decoration-black/20 underline-offset-4 hover:decoration-black self-start text-sm"
          >
            Resend confirmation email
          </button>
        )
      ) : null}
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
        className="text-muted-foreground hover:text-foreground self-start text-sm underline-offset-4 hover:underline"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
