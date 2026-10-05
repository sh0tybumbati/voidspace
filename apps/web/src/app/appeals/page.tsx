'use client';

import Link from 'next/link';
import { Gavel } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';

interface Row { id: string; status: string; reason: string; reviewerNotes?: string | null; createdAt: string; resolvedAt?: string | null; space: string; action: { actionType: string; reason: string } }
const TONE = { pending: 'warn', approved: 'ok', denied: 'danger', escalated: 'info' } as const;
const EXPLAIN: Record<string, string> = { pending: 'Waiting for a different moderator to review it.', escalated: 'Sent to the site admins for a final decision.', approved: 'Approved. The moderation was reversed.', denied: 'Denied.' };

export default function MyAppealsPage() {
  const { user, isLoading } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.get<{ appeals: Row[] }>('/api/appeals/mine'), [user?.id], { enabled: Boolean(user) });
  if (!isLoading && !user) return <EmptyState title="Sign in to see your appeals" action={<Link href="/login?redirect=/appeals" className="link">Sign in</Link>} />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Gavel size={22} className="text-accent-text" /> My appeals</h1><p className="mt-1 text-sm text-ink-2">If a moderator removes your post or bans you, you can appeal within 30 days. A different moderator reviews it.</p></header>
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <Skeleton className="h-32 w-full" /> : null}
      {data && !data.appeals.length ? <EmptyState title="No appeals">You have not appealed anything. If something of yours is removed, the notification links straight to the appeal form.</EmptyState> : null}
      <div className="space-y-3">
        {data?.appeals.map((a) => (
          <article key={a.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone={TONE[a.status as keyof typeof TONE] ?? 'neutral'}>{a.status}</Badge><Link href={`/v/${a.space}`} className="font-semibold text-ink-2 hover:underline">v/{a.space}</Link><TimeAgo date={a.createdAt} /></div>
            <p className="mt-2 text-sm"><b>{a.action.actionType.replace('_', ' ')}:</b> <span className="text-ink-2">{a.action.reason}</span></p>
            <p className="mt-2 rounded border border-line bg-surface-2 p-3 text-sm text-ink-2"><span className="meta block">Your appeal</span>{a.reason}</p>
            <p className="mt-2 text-xs text-muted">{EXPLAIN[a.status]}</p>
            {a.reviewerNotes ? <p className="mt-2 rounded border border-line bg-surface-2 p-3 text-sm text-ink-2"><span className="meta block">Reviewer</span>{a.reviewerNotes}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
