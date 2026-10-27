import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { readAuthParams, type AuthSearchParams } from '../search-params';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage({ searchParams }: { searchParams: AuthSearchParams }) {
  const { next } = await readAuthParams(searchParams);
  // `next` is a validated same-origin path (safeNextPath).
  if (await getUser()) redirect(next as Route);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground text-sm">Join Carza in under a minute.</p>
      </div>
      <OAuthButtons next={next} />
      <SignUpForm />
      <p className="text-muted-foreground text-sm">
        Already have an account?{' '}
        <Link
          href={{ pathname: '/sign-in', query: { next } }}
          className="text-foreground font-semibold underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
