'use client';

// Last-resort boundary when the root layout itself fails. Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" style={{ colorScheme: 'light dark' }}>
      <body
        style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 1rem', textAlign: 'center' }}
      >
        <h1>Something went wrong</h1>
        {error.digest ? <p>Reference: {error.digest}</p> : null}
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
