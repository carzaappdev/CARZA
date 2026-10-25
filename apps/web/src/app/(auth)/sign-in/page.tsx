import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { SignInForm } from '@/components/auth/sign-in-form';
import { readAuthParams, type AuthSearchParams } from '../search-params';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: { searchParams: AuthSearchParams }) {
  const { next, error } = await readAuthParams(searchParams);
  // `next` is a validated same-origin path (safeNextPath).
  if (await getUser()) redirect(next as Route);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your Carza account.</p>
      </div>
      <OAuthButtons next={next} />
      <SignInForm next={next} initialError={error} />
      <p className="text-muted-foreground text-sm">
        New to Carza?{' '}
        <Link href={{ pathname: '/sign-up', query: { next } }} className="text-primary font-medium">
          Create an account
        </Link>
      </p>
    </div>
  );
}
