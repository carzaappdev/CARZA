import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { ShieldCheckIcon } from 'lucide-react';
import {
  SOCIAL_REPORT_REASONS,
  SOCIAL_REPORT_TARGETS,
  URGENT_REPORT_REASONS,
  type SocialReportReason,
} from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { ReportActions, UnsuspendButton } from '@/components/safety/report-actions';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reports' };

const REASON_LABEL = new Map<string, string>(SOCIAL_REPORT_REASONS);
const isUrgent = (reason: string) => URGENT_REPORT_REASONS.includes(reason as SocialReportReason);
const OWNER_KEY: Record<string, string> = {
  post: 'author_id',
  reel: 'author_id',
  event: 'host_id',
  message: 'sender_id',
};

/** "Due in 31h" / "Overdue by 3h" against the 48-hour removal deadline for urgent reports. */
function deadline(createdAt: string) {
  const hours = Math.round(
    (new Date(createdAt).getTime() + 48 * 3_600_000 - Date.now()) / 3_600_000,
  );
  return hours >= 0 ? `Due in ${hours}h` : `Overdue by ${-hours}h`;
}

function describe(type: string, id: string, snapshot: Record<string, unknown>) {
  const text = (key: string) =>
    typeof snapshot[key] === 'string' ? (snapshot[key] as string) : '';
  switch (type) {
    case 'post':
      return { href: `/p/${id}`, preview: text('body') || '(photo post)' };
    case 'reel':
      return { href: `/reels/${id}`, preview: text('caption') || '(reel)' };
    case 'event':
      return { href: `/events/${id}`, preview: text('title') };
    case 'user':
      return { href: `/u/${text('username')}`, preview: `@${text('username')} · ${text('bio')}` };
    case 'message':
      // Admins can't open someone's DMs; the reported message is kept in the snapshot.
      return { href: null, preview: text('body') };
    default:
      return { href: null, preview: type };
  }
}

/** Admin review queue for open reports. */
export default async function ReportsPage() {
  await requireAdmin('/account/reports');
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from('reports')
    .select('id, target_type, target_id, reason, details, target_snapshot, created_at')
    .in('status', ['open', 'reviewing'])
    // Marketplace reports wait until the marketplace is switched back on.
    .in('target_type', [...SOCIAL_REPORT_TARGETS])
    .order('created_at', { ascending: true })
    .limit(300);

  // One card per reported thing (oldest report first), with how many people reported it.
  const grouped = new Map<string, { report: NonNullable<typeof reports>[number]; count: number }>();
  for (const r of reports ?? []) {
    const key = `${r.target_type}:${r.target_id}`;
    const seen = grouped.get(key);
    if (seen) seen.count += 1;
    else grouped.set(key, { report: r, count: 1 });
  }
  // Child safety and intimate-image reports jump the queue: the law gives 48 hours.
  const queue = [...grouped.values()].sort(
    (a, b) => Number(isUrgent(b.report.reason)) - Number(isUrgent(a.report.reason)),
  );

  // Earlier removals per person, so repeat offenders stand out.
  const [{ data: actions }, { data: suspended }] = await Promise.all([
    supabase
      .from('moderation_actions')
      .select('target_user_id')
      .eq('action', 'remove_content')
      .limit(2000),
    supabase
      .from('profiles')
      .select('id, username, display_name, suspended_at')
      .not('suspended_at', 'is', null)
      .order('suspended_at', { ascending: false })
      .limit(100),
  ]);
  const strikes = new Map<string, number>();
  for (const a of actions ?? []) {
    if (a.target_user_id) strikes.set(a.target_user_id, (strikes.get(a.target_user_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${queue.length} open, urgent first, then oldest. Remove takes it down for everyone; Suspend hides everything from that account.`}
      />
      {queue.length ? (
        <ul className="flex flex-col gap-3">
          {queue.map(({ report: r, count }) => {
            const snapshot =
              r.target_snapshot &&
              typeof r.target_snapshot === 'object' &&
              !Array.isArray(r.target_snapshot)
                ? (r.target_snapshot as Record<string, unknown>)
                : {};
            const { href, preview } = describe(r.target_type, r.target_id, snapshot);
            const urgent = isUrgent(r.reason);
            const ownerKey = OWNER_KEY[r.target_type];
            const owner = r.target_type === 'user' ? r.target_id : ownerKey && snapshot[ownerKey];
            const prior = typeof owner === 'string' ? (strikes.get(owner) ?? 0) : 0;
            return (
              <li
                key={r.id}
                className={`flex flex-col gap-2 rounded-2xl border p-4 ${urgent ? 'border-destructive' : ''}`}
              >
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {r.target_type} · {REASON_LABEL.get(r.reason) ?? r.reason} ·{' '}
                  {new Date(r.created_at).toLocaleDateString('en-US')}
                  {count > 1 ? ` · ${count} reports` : ''}
                  {prior > 0 ? ` · ${prior} earlier ${prior === 1 ? 'removal' : 'removals'}` : ''}
                </p>
                {urgent ? (
                  <p className="text-destructive text-sm font-semibold">
                    Urgent · {deadline(r.created_at)}
                  </p>
                ) : null}
                <p className="line-clamp-4 text-[15px] break-words whitespace-pre-wrap">
                  {preview}
                </p>
                {r.details ? <p className="text-muted-foreground text-sm">“{r.details}”</p> : null}
                <div className="flex items-center gap-2">
                  {href ? (
                    <Link
                      href={href as Route}
                      className="text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                  <ReportActions
                    reportId={r.id}
                    canRemove={r.target_type !== 'user'}
                    canEscalate={r.reason === 'child_safety'}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState Icon={ShieldCheckIcon} title="All clear" body="No open reports right now." />
      )}
      {suspended?.length ? (
        <section aria-labelledby="suspended-heading" className="flex flex-col gap-3">
          <h2 id="suspended-heading" className="font-display text-lg font-bold">
            Suspended accounts
          </h2>
          <ul className="flex flex-col gap-2">
            {suspended.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border p-3 pl-4">
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  <span className="font-semibold">{p.display_name}</span>{' '}
                  <span className="text-muted-foreground">@{p.username}</span>
                </span>
                <UnsuspendButton userId={p.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
