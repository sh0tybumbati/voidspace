'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Scale, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import type { ModLogEntry, Pagination } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';

const LABEL: Record<string, string> = { remove_post: 'Removed a post', remove_comment: 'Removed a comment', restore_post: 'Restored a post', restore_comment: 'Restored a comment', ban_user: 'Banned a user', unban_user: 'Lifted a ban', pin_post: 'Pinned a post', unpin_post: 'Unpinned a post' };
const TONE: Record<string, 'danger' | 'ok' | 'warn'> = { remove_post: 'danger', remove_comment: 'danger', ban_user: 'warn', restore_post: 'ok', restore_comment: 'ok', unban_user: 'ok' };

export default function ModLogPage() {
  const { name } = useParams<{ name: string }>();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => api.get<{ actions: ModLogEntry[]; pagination: Pagination }>(`/api/mod/${name}/log?page=${page}&limit=30`), [name, page]);

  return (
    <div className="max-w-4xl space-y-5">
      <header>
        <p className="meta"><Link href={`/v/${name}`} className="hover:text-ink">v/{name}</Link> / mod log</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><Scale size={22} className="text-accent-text" /> Public mod log</h1>
        <p className="mt-1 text-sm text-ink-2">Every action by a moderator of this space, with the reason they gave. Nothing here can be hidden or edited. Reversed actions stay in the log.</p>
      </header>
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div> : null}
      {data && !data.actions.length ? <EmptyState title="Nothing has been moderated yet">When a moderator acts, it appears here.</EmptyState> : null}
      <ol className="space-y-2">
        {data?.actions.map((a) => (
          <li key={a.id} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge tone={TONE[a.actionType] ?? 'neutral'}>{LABEL[a.actionType] ?? a.actionType}</Badge>
              <span className="text-sm">by <Link href={`/u/${a.mod?.username ?? a.moderator}`} className="font-semibold hover:underline">{a.mod?.username ?? a.moderator}</Link></span>
              <TimeAgo date={a.createdAt} className="text-xs text-muted" />
              {a.reversedAt ? <Badge tone="info"><Undo2 size={10} /> Reversed <TimeAgo date={a.reversedAt} /></Badge> : null}
            </div>
            <p className="mt-1.5 text-sm text-ink-2">{a.reason}</p>
          </li>
        ))}
      </ol>
      {data && data.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm"><Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button><span className="font-mono text-xs text-muted">{page} / {data.pagination.totalPages}</span><Button size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Older</Button></div>
      ) : null}
    </div>
  );
}
