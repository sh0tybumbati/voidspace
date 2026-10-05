'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync } from '@/lib/hooks';
import type { Pagination, Post } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import PostCard from '@/components/posts/PostCard';

type Tab = 'posts' | 'comments';
interface SavedComment { id: string; content: string; voteScore: number; createdAt: string; post?: { id: string; title: string; space?: { name: string } } }

export default function SavedPage() {
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('posts');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(
    () => (tab === 'posts' ? api.getSavedPosts(page, 20) : api.getSavedComments(page, 20)) as Promise<{ posts?: Post[]; comments?: SavedComment[]; pagination: Pagination }>,
    [tab, page, user?.id], { enabled: Boolean(user) },
  );
  if (!isLoading && !user) return <EmptyState title="Sign in to see what you saved" action={<Link href="/login?redirect=/saved" className="link">Sign in</Link>} />;
  const items = tab === 'posts' ? data?.posts : data?.comments;

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Bookmark size={22} className="text-accent-text" /> Saved</h1>
      <Tabs<Tab> value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ id: 'posts', label: 'Posts' }, { id: 'comments', label: 'Comments' }]} />
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <Skeleton className="h-32 w-full" /> : null}
      {data && !items?.length ? <EmptyState icon={<Bookmark size={26} />} title={`No saved ${tab}`}>Hit save on a post or comment and it will wait for you here.</EmptyState> : null}
      {tab === 'posts' ? <div className="space-y-3">{data?.posts?.map((p) => <PostCard key={p.id} post={p} />)}</div> : (
        <div className="space-y-2">{data?.comments?.map((c) => (
          <Link key={c.id} href={c.post ? `/v/${c.post.space?.name ?? 'all'}/${c.post.id}` : '#'} className="block rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
            <p className="meta">{c.post?.title} <TimeAgo date={c.createdAt} /></p><p className="mt-1.5 line-clamp-3 text-sm text-ink-2">{c.content}</p>
          </Link>
        ))}</div>
      )}
      {data && data.pagination.totalPages > 1 ? <div className="flex items-center justify-center gap-3"><Button size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Newer</Button><span className="font-mono text-xs text-muted">{page} / {data.pagination.totalPages}</span><Button size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((n) => n + 1)}>Older</Button></div> : null}
    </div>
  );
}
