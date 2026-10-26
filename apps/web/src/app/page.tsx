import Link from 'next/link';
import { getUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getUser();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Carza</h1>
      <p className="text-muted-foreground text-lg">
        Buy and sell cars locally, from dealers and private sellers near you.
      </p>
      {user ? (
        <Link href="/account" className="text-primary font-medium" data-testid="account-link">
          Your account
        </Link>
      ) : (
        <div className="flex gap-3">
          <Link
            href="/sign-in"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-medium"
          >
            Sign in
          </Link>
          <Link href="/sign-up" className="border-input rounded-md border px-4 py-2 font-medium">
            Create account
          </Link>
        </div>
      )}
    </main>
  );
}
