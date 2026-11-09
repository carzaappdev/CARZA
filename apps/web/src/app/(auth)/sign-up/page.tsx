import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getProfile } from '@carza/db';
import { UserAvatar } from '@/components/feed/user-avatar';
import { getUser } from '@/lib/auth';
import { enabledOAuthProviders } from '@/lib/auth-providers';
import { INVITE_COOKIE, validUsername } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { readAuthParams, type AuthSearchParams } from '../search-params';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignUpPage({ searchParams }: { searchParams: AuthSearchParams }) {
  const { next } = await readAuthParams(searchParams);
  // `next` is a validated same-origin path (safeNextPath).
  if (await getUser()) redirect(next as Route);
  // Came from someone's invite link: remind people who they'll be connected with.
  const ref = (await cookies()).get(INVITE_COOKIE)?.value;
  const inviter =
    ref && validUsername(ref) ? await getProfile(await createClient(), ref, null) : null;
  return (
    <div className="flex flex-col gap-5">
      {inviter ? (
        <p className="bg-muted/60 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
          <UserAvatar name={inviter.display_name} path={inviter.avatar_path} className="size-8" />
          <span>
            <span className="font-semibold">{inviter.display_name}</span> invited you. You’ll follow
            them when you join.
          </span>
        </p>
      ) : null}
      <SignUpForm>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-muted-foreground text-sm">Join Carza in under a minute.</p>
        </div>
        <OAuthButtons next={next} providers={await enabledOAuthProviders()} />
      </SignUpForm>
      <p className="text-muted-foreground text-xs leading-relaxed">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="text-foreground underline underline-offset-4">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/guidelines" className="text-foreground underline underline-offset-4">
          Community Guidelines
        </Link>
        . See how we handle your data in our{' '}
        <Link href="/privacy" className="text-foreground underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
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
