import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold tracking-tight">Reset your password</h1>
      <p className="text-muted-foreground text-sm">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <ResetPasswordForm />
      <Link
        href="/sign-in"
        className="text-foreground font-semibold underline decoration-black/20 underline-offset-4 hover:decoration-black text-sm"
      >
        Back to sign in
      </Link>
    </div>
  );
}
