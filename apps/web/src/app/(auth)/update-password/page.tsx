import type { Metadata } from 'next';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Choose a new password' };

// Reached from the recovery email via /auth/confirm, which signs the user in first.
export default async function UpdatePasswordPage() {
  await requireUser('/update-password');
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <UpdatePasswordForm />
    </div>
  );
}
