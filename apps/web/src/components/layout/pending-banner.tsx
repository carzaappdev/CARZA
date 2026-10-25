import type { Enums } from '@carza/db';

const COPY: Partial<Record<Enums<'verification_status'>, string>> = {
  pending:
    "Pending verification. You can set up your dealership and add draft listings now. They go live once we've verified you.",
  rejected:
    "Your dealership wasn't verified. Your listings aren't public. Contact support to find out why.",
  suspended: 'Your dealership is suspended. Your listings are hidden from buyers. Contact support.',
};

/** Shown across the dealer dashboard whenever the dealership isn't verified. */
export function PendingBanner({ status }: { status: Enums<'verification_status'> }) {
  const text = COPY[status];
  if (!text) return null;
  return (
    <div
      role="status"
      className="bg-warning/15 border-warning/40 border-b px-4 py-3 text-sm sm:px-6"
    >
      {text}
    </div>
  );
}
