'use client';

import { useState, type FormEvent } from 'react';
import { authErrorMessage, fieldErrors, signUpSchema } from '@carza/shared';
import { createClient } from '@/lib/supabase/browser';
import { Field, FormMessage, SubmitButton } from './fields';

export function SignUpForm({ next }: { next: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signUpSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError(null);
    setPending(true);

    const { email, password, displayName } = parsed.data;
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);
    if (error) return setFormError(authErrorMessage(error.code));
    // Supabase returns success for existing emails too (no account enumeration), so the message is neutral.
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <FormMessage tone="success">
        {`Check your inbox. If ${sentTo} can be used, we've sent a link to confirm your account.`}
      </FormMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="Your name"
        name="displayName"
        autoComplete="name"
        required
        error={errors.displayName}
      />
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
        autoComplete="new-password"
        required
        error={errors.password}
      />
      <p className="text-muted-foreground -mt-2 text-xs">
        At least 10 characters, with letters and numbers.
      </p>
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
