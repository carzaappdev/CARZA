import type { Metadata } from 'next';
import Link from 'next/link';
import { Divider, OAuthButtons } from '@/components/auth/oauth-buttons';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { readAuthParams, type AuthSearchParams } from '../search-params';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage({ searchParams }: { searchParams: AuthSearchParams }) {
  const { next } = await readAuthParams(searchParams);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <OAuthButtons next={next} />
      <Divider />
      <SignUpForm next={next} />
      <p className="text-muted-foreground text-sm">
        Already have an account?{' '}
        <Link href={{ pathname: '/sign-in', query: { next } }} className="text-primary font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
