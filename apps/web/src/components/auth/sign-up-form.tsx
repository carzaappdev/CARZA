'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { MailCheckIcon } from 'lucide-react';
import { MIN_AGE, ageOn, authErrorMessage, fieldErrors, signUpSchema } from '@carza/shared';
import { blockAge, useAgeBlocked } from '@/lib/age-block';
import { createClient } from '@/lib/supabase/browser';
import { AgeBlocked } from './age-blocked';
import { Field, FormMessage, PasswordField, SubmitButton, useFocusFirstInvalid } from './fields';

/** `children` (the heading and social buttons) are hidden once the email is sent. */
export function SignUpForm({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useFocusFirstInvalid(errors);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ageBlocked = useAgeBlocked();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signUpSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError(null);
    // Too young: stop here, before anything is sent, and remember it on this device.
    if ((ageOn(parsed.data.birthDate) ?? 0) < MIN_AGE) return blockAge();
    setPending(true);

    const { email, password, displayName, birthDate } = parsed.data;
    const { error } = await createClient().auth.signUp({
      email,
      password,
      // Carza's email template links to /auth/confirm. emailRedirectTo is the fallback for Supabase's
      // default template (PKCE code → /auth/callback), so confirming works either way.
      options: {
        data: { display_name: displayName, birth_date: birthDate },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome&from=signup`,
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

  if (ageBlocked) return <AgeBlocked />;
  if (sentTo) return <CheckInbox email={sentTo} onStartOver={() => setSentTo(null)} />;

  return (
    <>
      {children}
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
          label="Date of birth"
          name="birthDate"
          type="date"
          autoComplete="bday"
          required
          error={errors.birthDate}
          hint="Private. Never shown on your profile."
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          required
          error={errors.password}
          hint="At least 10 characters, with letters and numbers."
        />
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
    </>
  );
}

const RESEND_COOLDOWN = 60;

/** After sign-up: where the email went, how to get another, and a way back if the address was wrong. */
function CheckInbox({ email, onStartOver }: { email: string; onStartOver: () => void }) {
  const [wait, setWait] = useState(RESEND_COOLDOWN);
  const [note, setNote] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function resend() {
    setWait(RESEND_COOLDOWN);
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome&from=signup`,
      },
    });
    setNote(
      error?.code?.startsWith('over_')
        ? { tone: 'error', text: authErrorMessage(error.code) }
        : { tone: 'success', text: 'Sent. It can take a minute to arrive.' },
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status">
      <span className="bg-success/10 text-success grid size-14 place-items-center rounded-full">
        <MailCheckIcon className="size-7" aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl font-bold tracking-tight">Check your email</h2>
        <p className="text-muted-foreground text-[15px]">
          We sent a link to <span className="text-foreground font-medium break-all">{email}</span>.
          Open it to finish setting up your account.
        </p>
      </div>
      {note ? <FormMessage tone={note.tone}>{note.text}</FormMessage> : null}
      <p className="text-muted-foreground text-sm">
        Nothing yet? Check spam, or{' '}
        <button
          type="button"
          onClick={resend}
          disabled={wait > 0}
          className="text-foreground font-semibold underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground disabled:text-muted-foreground disabled:no-underline"
        >
          {wait > 0 ? `resend in ${wait}s` : 'send it again'}
        </button>
        .
      </p>
      <button
        type="button"
        onClick={onStartOver}
        className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
      >
        Wrong email? Start over
      </button>
    </div>
  );
}
