'use client';

import { useState, type FormEvent } from 'react';
import { authErrorMessage, fieldErrors, signUpSchema } from '@carza/shared';
import { createClient } from '@/lib/supabase/browser';
import { Field, FormMessage, SubmitButton, useFocusFirstInvalid } from './fields';

export function SignUpForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useFocusFirstInvalid(errors);
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
        // Works with Supabase's default email template: the link returns here with a PKCE code.
        emailRedirectTo: `${window.location.origin}/auth/callback?flow=email&next=/account`,
      },
    });
    setPending(false);
    // "Already registered" gets the same response as success, so this form can't be used to test which
    // emails have accounts. (The API itself still leaks it; CAPTCHA on sign-up mitigates scripted probing.)
    // The email-throttle error is neutral too: otherwise a quick double submit would reveal whether the
    // first one created an account.
    const neutral = ['user_already_exists', 'over_email_send_rate_limit'];
    if (error && !neutral.includes(error.code ?? ''))
      return setFormError(authErrorMessage(error.code));
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <FormMessage tone="success">
        {`Check your inbox at ${sentTo} for a link to finish setting up your account.`}
      </FormMessage>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
        hint="At least 10 characters, with letters and numbers."
      />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
