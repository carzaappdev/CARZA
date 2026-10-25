import Link from 'next/link';
import { CarzaLogo } from '@/components/brand/logo';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <CarzaLogo size="md" />
      <h1 className="font-display mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        That page doesn&apos;t exist or is no longer available.
      </p>
      <Link href="/" className="text-primary font-medium underline-offset-4 hover:underline">
        Go home
      </Link>
    </main>
  );
}
