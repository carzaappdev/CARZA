'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authErrorMessage, fieldErrors, updatePasswordSchema } from '@carza/shared';
import { createClient } from '@/lib/supabase/browser';
import { Field, FormMessage, SubmitButton, useFocusFirstInvalid } from './fields';

export function UpdatePasswordForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useFocusFirstInvalid(errors);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updatePasswordSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError(null);
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
    if (error) {
      setFormError(authErrorMessage(error.code));
      setPending(false);
      return;
    }
    router.replace('/account');
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.password}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <SubmitButton pending={pending}>Update password</SubmitButton>
    </form>
  );
}
