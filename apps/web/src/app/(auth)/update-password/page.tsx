import type { Metadata } from 'next';
import Link from 'next/link';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { hasRecentRecoverySession, requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Choose a new password' };

// Only reachable right after using a password-reset link (via /auth/confirm). An ordinary signed-in
// session can't change the password without proving access to the email first.
export default async function UpdatePasswordPage() {
  await requireUser('/update-password');
  if (!(await hasRecentRecoverySession())) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Change your password</h1>
        <p className="text-muted-foreground text-sm">
          For your security, we need to confirm it&apos;s you. We&apos;ll email you a link to set a
          new password.
        </p>
        <Link
          href="/reset-password"
          className="text-foreground font-semibold underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
        >
          Send me a reset link
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold tracking-tight">Choose a new password</h1>
      <UpdatePasswordForm />
    </div>
  );
}
