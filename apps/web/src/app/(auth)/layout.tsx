import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 text-2xl font-bold tracking-tight">
        Carza
      </Link>
      <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">{children}</div>
    </main>
  );
}
