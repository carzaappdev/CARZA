'use client';

import { useState, type FormEvent } from 'react';
import { authErrorMessage, fieldErrors, resetPasswordSchema } from '@carza/shared';
import { createClient } from '@/lib/supabase/browser';
import { Field, FormMessage, SubmitButton, useFocusFirstInvalid } from './fields';

export function ResetPasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useFocusFirstInvalid(errors);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError(null);
    setPending(true);
    // The link returns via /auth/callback (PKCE) and lands on /update-password.
    const { error } = await createClient().auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    setPending(false);
    // Rate limits are worth surfacing; anything else gets the neutral message (no account enumeration).
    if (error?.code?.startsWith('over_')) return setFormError(authErrorMessage(error.code));
    setSent(true);
  }

  if (sent) {
    return (
      <FormMessage tone="success">
        If an account exists for that email, we&apos;ve sent a link to reset your password.
      </FormMessage>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}
