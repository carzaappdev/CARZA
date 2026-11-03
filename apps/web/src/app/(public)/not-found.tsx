import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** 404 inside the app: the header already shows the logo, so this is just the message. */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        That page doesn&apos;t exist or is no longer available.
      </p>
      <div className="mt-2 flex gap-2">
        <Button asChild className="rounded-full">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/events">Find events</Link>
        </Button>
      </div>
    </div>
  );
}
