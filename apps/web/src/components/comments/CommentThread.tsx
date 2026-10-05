'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync } from '@/lib/hooks';
import { useThreadLive } from '@/lib/live';
import type { Comment } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorNotice, Skeleton } from '@/components/ui/Misc';
import CommentItem, { CommentComposer, CommentNode, ThreadContext } from './CommentItem';

type Sort = 'top' | 'new' | 'old';

function buildTree(flat: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>(flat.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentCommentId ? byId.get(node.parentCommentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

/** The comment tree for a post, with a composer and a banner when new comments arrive live. */
export default function CommentThread({ postId, spaceName, postAuthor, isModerator, locked }: { postId: string; spaceName: string; postAuthor: string; isModerator: boolean; locked?: boolean }) {
  const { user } = useAuth();
  const [sort, setSort] = useState<Sort>('top');
  const [fresh, setFresh] = useState(0);
  const { data, error, loading, reload } = useAsync(() => api.getPostComments(postId, sort) as Promise<{ comments: Comment[]; totalCount: number }>, [postId, sort]);

  const refresh = useCallback(() => { setFresh(0); void reload(); }, [reload]);
  useThreadLive(postId, (c) => { if (c.author !== user?.username) setFresh((n) => n + 1); });

  const tree = useMemo(() => buildTree(data?.comments ?? []), [data]);
  const ctx: ThreadContext = { postId, spaceName, postAuthor, isModerator, canComment: Boolean(user) && !locked, reload: refresh };

  return (
    <section id="comments" aria-label="Comments" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{data ? `${data.totalCount} ${data.totalCount === 1 ? 'comment' : 'comments'}` : 'Comments'}</h2>
        <div className="flex items-center gap-1 text-sm">
          {(['top', 'new', 'old'] as Sort[]).map((s) => (
            <button key={s} onClick={() => setSort(s)} aria-pressed={sort === s} className={`rounded px-2.5 py-1 font-medium capitalize transition ${sort === s ? 'bg-surface-3 text-ink' : 'text-muted hover:text-ink'}`}>{s}</button>
          ))}
        </div>
      </div>

      {user && !locked ? <CommentComposer ctx={ctx} onDone={() => undefined} /> : !user ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm"><span className="text-ink-2">Join the conversation.</span><span className="flex gap-2"><Link href="/login" className="font-semibold text-accent-text hover:underline">Sign in</Link><Link href="/register" className="font-semibold hover:underline">Sign up</Link></span></div>
      ) : null}

      {fresh > 0 ? (
        <button onClick={refresh} className="flex w-full animate-rise items-center justify-center gap-2 rounded border border-accent/50 bg-accent/10 py-2 text-sm font-semibold text-accent-text hover:bg-accent/15">
          <RefreshCw size={14} /> {fresh} new {fresh === 1 ? 'comment' : 'comments'}. Show
        </button>
      ) : null}

      {loading && !data ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div> : null}
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {data && !tree.length ? <EmptyState title="No comments yet">Be the first to say something.</EmptyState> : null}
      <div className="space-y-1">{tree.map((n) => <CommentItem key={n.id} node={n} ctx={ctx} />)}</div>
      {data ? <div className="flex justify-center"><Button size="sm" variant="ghost" onClick={refresh}><RefreshCw size={14} /> Refresh</Button></div> : null}
    </section>
  );
}
