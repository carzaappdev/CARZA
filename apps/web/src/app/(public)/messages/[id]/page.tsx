import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { z } from 'zod';
import { getConversation } from '@carza/db';
import { UserAvatar } from '@/components/feed/user-avatar';
import { Conversation } from '@/components/messages/conversation';
import { SafetyMenu } from '@/components/safety/safety-menu';
import { UnblockButton } from '@/components/safety/unblock-button';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Messages' };

type Props = { params: Promise<{ id: string }> };

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/messages/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const conversation = await getConversation(await createClient(), id, user.id);
  if (!conversation) notFound();
  const { other } = conversation;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col sm:border-x">
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-14 z-30 flex items-center gap-1 border-b px-1 py-1.5 backdrop-blur md:top-16">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="hover:bg-accent focus-visible:ring-ring/50 grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
        >
          <ChevronLeftIcon className="size-6" aria-hidden />
        </Link>
        <Link
          href={`/u/${other.username}`}
          className="hover:bg-accent/50 focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1 outline-none focus-visible:ring-[3px]"
        >
          <UserAvatar name={other.display_name} path={other.avatar_path} className="size-9" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-tight font-semibold">
              {other.display_name}
            </span>
            <span className="text-muted-foreground block truncate text-sm leading-tight">
              @{other.username}
            </span>
          </span>
        </Link>
        {conversation.viewerBlocked ? null : (
          <SafetyMenu targetType="user" targetId={other.id} owner={other} viewerId={user.id} />
        )}
      </header>
      <Conversation
        key={conversation.id}
        conversationId={conversation.id}
        viewerId={user.id}
        other={other}
        initialMessages={conversation.messages}
        initialHasOlder={conversation.hasOlder}
        canSend={!conversation.viewerBlocked}
      />
      {conversation.viewerBlocked ? (
        <div className="bg-background sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] border-t px-4 py-4 md:bottom-0">
          <UnblockButton userId={other.id} username={other.username} />
        </div>
      ) : null}
    </div>
  );
}
