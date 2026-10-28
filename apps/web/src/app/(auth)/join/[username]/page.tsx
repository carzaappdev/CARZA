import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getProfile } from '@carza/db';
import { UserAvatar } from '@/components/feed/user-avatar';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth';
import { validUsername } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ username: string }> };

const loadInviter = cache(async (username: string) =>
  validUsername(username) ? getProfile(await createClient(), username, null) : null,
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const inviter = await loadInviter((await params).username);
  if (!inviter) return { title: 'Join Carza' };
  return {
    title: `${inviter.display_name} invited you to Carza`,
    description: 'Share your ride, watch car reels and find meets near you.',
  };
}

/** Invite landing: who sent it, and one button to join. */
export default async function JoinPage({ params }: Props) {
  const { username } = await params;
  const inviter = await loadInviter(username);
  if (!inviter) notFound();
  if (await getUser()) redirect(`/u/${inviter.username}` as Route);

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <UserAvatar name={inviter.display_name} path={inviter.avatar_path} large />
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {inviter.display_name} invited you to Carza
        </h1>
        <p className="text-muted-foreground text-[15px]">
          Share your ride, watch car reels and find meets near you. You’ll follow @
          {inviter.username} when you join.
        </p>
      </div>
      <Button asChild size="lg" className="w-full rounded-full">
        <a href={`/join/${inviter.username}/accept`}>Join Carza</a>
      </Button>
      <p className="text-muted-foreground text-sm">
        Already have an account?{' '}
        <Link
          href="/sign-in"
          className="text-foreground font-semibold underline decoration-foreground/25 underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
