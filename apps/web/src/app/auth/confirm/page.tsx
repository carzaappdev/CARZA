import type { Metadata } from 'next';
import { CarzaLogo } from '@/components/brand/logo';
import { getUser } from '@/lib/auth';
import { confirmEmailLink } from '../actions';

export const metadata: Metadata = { title: 'Continue', robots: { index: false } };

type Params = Promise<{ token_hash?: string; type?: string; next?: string }>;

const COPY: Record<string, { title: string; button: string }> = {
  recovery: { title: 'Reset your password', button: 'Continue to reset password' },
  email_change: { title: 'Confirm your new email', button: 'Confirm email change' },
};
const DEFAULT_COPY = { title: 'Confirm your email', button: 'Confirm and continue' };

/**
 * Landing page for links in auth emails. Deliberately does nothing on GET: the token is only used when
 * the person clicks Continue (see confirmEmailLink).
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Params }) {
  const { token_hash: tokenHash = '', type = '', next = '' } = await searchParams;
  const copy = COPY[type] ?? DEFAULT_COPY;
  const current = await getUser();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <CarzaLogo size="md" />
      <div className="bg-card flex w-full max-w-sm flex-col gap-4 rounded-xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        {current ? (
          <p className="bg-warning/15 rounded-md px-3 py-2 text-sm">
            You&apos;re currently signed in as {current.email}. Continuing will switch to the
            account this link belongs to.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Only continue if you asked Carza for this email just now. If someone sent you this link,
            close this page.
          </p>
        )}
        <form action={confirmEmailLink} className="flex flex-col">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="bg-primary text-primary-foreground h-11 rounded-md font-medium"
          >
            {copy.button}
          </button>
        </form>
        <p className="text-muted-foreground text-xs">
          Didn&apos;t request this? You can close this page. Nothing happens unless you continue.
        </p>
      </div>
    </main>
  );
}
