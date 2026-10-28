import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { ShieldCheckIcon } from 'lucide-react';
import { SOCIAL_REPORT_REASONS, SOCIAL_REPORT_TARGETS } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { ReportActions } from '@/components/safety/report-actions';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reports' };

const REASON_LABEL = new Map<string, string>(SOCIAL_REPORT_REASONS);

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
    .limit(100);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Oldest first. Remove takes the content down for everyone."
      />
      {reports?.length ? (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => {
            const snapshot =
              r.target_snapshot &&
              typeof r.target_snapshot === 'object' &&
              !Array.isArray(r.target_snapshot)
                ? (r.target_snapshot as Record<string, unknown>)
                : {};
            const { href, preview } = describe(r.target_type, r.target_id, snapshot);
            return (
              <li key={r.id} className="flex flex-col gap-2 rounded-2xl border p-4">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {r.target_type} · {REASON_LABEL.get(r.reason) ?? r.reason} ·{' '}
                  {new Date(r.created_at).toLocaleDateString('en-US')}
                </p>
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
                  <ReportActions reportId={r.id} canRemove={r.target_type !== 'user'} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState Icon={ShieldCheckIcon} title="All clear" body="No open reports right now." />
      )}
    </>
  );
}
