'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock, Flame, Lock, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar, hueOf } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/auth-context';
import type { Pagination, Post, Space } from '@/lib/types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorNotice, Skeleton } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import PostCard from '@/components/posts/PostCard';
import SpaceSidebar from '@/components/layout/SpaceSidebar';

type Sort = 'hot' | 'new' | 'top';

export default function SpacePage() {
  const { name } = useParams<{ name: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [meta, setMeta] = useState({ isSubscribed: false, isModerator: false });
  const [status, setStatus] = useState<'loading' | 'ok' | 'private' | 'missing' | 'error'>('loading');
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>('hot');
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    setStatus('loading');
    api.getSpace(name)
      .then((d: { space: Space; isSubscribed: boolean; isModerator: boolean; permissions?: Record<string, boolean> | null }) => { setSpace({ ...d.space, permissions: d.permissions ?? null }); setMeta({ isSubscribed: d.isSubscribed, isModerator: d.isModerator }); setStatus('ok'); })
      .catch((e: Error & { message: string }) => setStatus(/private/i.test(e.message) ? 'private' : /not found/i.test(e.message) ? 'missing' : 'error'));
  }, [name, user, authLoading]);

  const loadPosts = useCallback(async (p: number, s: Sort) => {
    setLoadingPosts(true); setError(null);
    try {
      const d = await api.getSpacePosts(name, { page: p, limit: 20, sort: s });
      setPosts((prev) => (p === 1 ? d.posts : [...prev, ...d.posts])); setPagination(d.pagination);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load posts.'); }
    finally { setLoadingPosts(false); }
  }, [name]);

  useEffect(() => { if (status === 'ok') { setPage(1); void loadPosts(1, sort); } }, [status, sort, loadPosts]);

  if (status === 'loading') return <Skeleton className="h-96 w-full" />;
  if (status === 'private') return <EmptyState icon={<Lock size={28} />} title="This space is private" action={<ButtonLink href="/spaces" variant="secondary">Explore other spaces</ButtonLink>}>Only its members can see what is inside, and it is not taking new members.</EmptyState>;
  if (status === 'missing') return <EmptyState title="That space does not exist" action={<ButtonLink href="/spaces/create" variant="primary">Create it</ButtonLink>}>v/{name} is free. You could start it.</EmptyState>;
  if (status === 'error' || !space) return <ErrorNotice message="Could not load this space." />;

  const hue = hueOf(space.name);
  const tabs = [
    { id: 'hot' as Sort, label: <span className="flex items-center gap-1.5"><Flame size={14} /> Hot</span> },
    { id: 'new' as Sort, label: <span className="flex items-center gap-1.5"><Clock size={14} /> New</span> },
    { id: 'top' as Sort, label: <span className="flex items-center gap-1.5"><TrendingUp size={14} /> Top</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="relative h-28 overflow-hidden rounded-xl border border-line sm:h-40" style={space.bannerUrl ? undefined : { background: `linear-gradient(120deg, hsl(${hue} 55% 22%), hsl(${(hue + 70) % 360} 60% 14%) 55%, rgb(var(--surface)))` }}>
        {space.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={api.assetUrl(space.bannerUrl)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 120%, rgb(var(--accent) / .5), transparent 45%), radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: 'auto, 14px 14px' }} aria-hidden />
        )}
        {space.bannerUrl ? <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" aria-hidden /> : null}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
          <Avatar name={space.name} src={space.iconUrl} size={52} className="ring-2 ring-black/40" />
          <div className="min-w-0"><h1 className="truncate text-2xl font-bold tracking-tight text-white drop-shadow sm:text-3xl">{space.displayName}</h1><p className="font-mono text-xs text-white/70">v/{space.name}{space.isNsfw ? ' · adult' : ''}{space.isPrivate ? ' · private' : ''}</p></div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Tabs tabs={tabs} value={sort} onChange={setSort} className="flex-1" />
            {user && (meta.isSubscribed || meta.isModerator) ? <ButtonLink href={`/v/${space.name}/submit`} variant="primary" size="sm">New post</ButtonLink> : null}
          </div>
          {error ? <ErrorNotice message={error} onRetry={() => loadPosts(1, sort)} /> : null}
          {loadingPosts && !posts.length ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div> : null}
          {!loadingPosts && !posts.length && !error ? (
            <EmptyState title="No posts yet" action={user ? <ButtonLink href={`/v/${space.name}/submit`} variant="primary">Write the first post</ButtonLink> : <Link href="/login" className="link">Sign in to post</Link>}>This space is waiting for its first conversation.</EmptyState>
          ) : null}
          <div className="space-y-3">{posts.map((p) => <PostCard key={p.id} post={p} showSpace={false} />)}</div>
          {pagination && page < pagination.totalPages ? <div className="flex justify-center"><Button loading={loadingPosts} onClick={() => { const n = page + 1; setPage(n); void loadPosts(n, sort); }}>Load more</Button></div> : null}
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <SpaceSidebar space={space} isSubscribed={meta.isSubscribed} isModerator={meta.isModerator} onChanged={(joined) => { setMeta((m) => ({ ...m, isSubscribed: joined })); setSpace((s) => (s ? { ...s, subscriberCount: s.subscriberCount + (joined ? 1 : -1) } : s)); }} />
        </aside>
      </div>
    </div>
  );
}
