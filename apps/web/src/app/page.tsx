'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, Compass, Flame, Newspaper, Scale, TrendingUp, Users, Vote } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Pagination, Post, SpaceSummary } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorNotice, Skeleton } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import PostCard from '@/components/posts/PostCard';

type Feed = 'hot' | 'new' | 'top' | 'subscribed';

function Hero() {
  const points = [
    { icon: Vote, title: 'Moderators are elected', body: 'Communities vote their moderators in and out. No one is appointed for life.' },
    { icon: Scale, title: 'Moderation is public', body: 'Every removal and ban is logged with a reason anyone can read.' },
    { icon: Newspaper, title: 'Appeals go to someone else', body: 'If a moderator removes your post, a different moderator hears your appeal.' },
  ];
  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-surface p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-accent/20" aria-hidden />
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border border-accent/30" aria-hidden />
      <p className="meta text-accent-text">A different kind of community site</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">Communities that govern themselves, in the open.</h1>
      <p className="mt-3 max-w-xl text-ink-2">Voidspace has the discussions you expect, plus a rule book that is enforced on the platform too: elected moderators, public logs, real appeals.</p>
      <div className="mt-5 flex flex-wrap gap-2"><ButtonLink href="/register" variant="primary" size="lg">Create an account</ButtonLink><ButtonLink href="/about" variant="outline" size="lg">How it works</ButtonLink></div>
      <ul className="mt-7 grid gap-4 sm:grid-cols-3">
        {points.map((p) => (<li key={p.title} className="flex gap-3"><p.icon size={18} className="mt-0.5 shrink-0 text-accent-text" /><div><p className="text-sm font-semibold">{p.title}</p><p className="mt-0.5 text-[0.82rem] text-muted">{p.body}</p></div></li>))}
      </ul>
    </section>
  );
}

function PopularSpaces() {
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null);
  useEffect(() => { api.getSpaces({ limit: 6, sortBy: 'popular' }).then((r: { spaces: SpaceSummary[] }) => setSpaces(r.spaces)).catch(() => setSpaces([])); }, []);
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><TrendingUp size={15} /> Popular spaces</span>} action={<Link href="/spaces" className="text-xs font-medium text-accent-text hover:underline">See all</Link>} />
      <ul className="p-2">
        {spaces === null ? [0, 1, 2].map((i) => <li key={i} className="p-2"><Skeleton className="h-8 w-full" /></li>) : null}
        {spaces?.map((s) => (
          <li key={s.name}><Link href={`/v/${s.name}`} className="flex items-center gap-3 rounded px-2 py-2 hover:bg-surface-2"><Avatar name={s.name} src={s.iconUrl} size={30} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">v/{s.name}</p><p className="flex items-center gap-1 text-xs text-muted"><Users size={11} /> {s.subscriberCount} members</p></div></Link></li>
        ))}
        {spaces && !spaces.length ? <li className="p-3 text-sm text-muted">No spaces yet. Start one!</li> : null}
      </ul>
    </Card>
  );
}

function HomeFeed() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const feed = (params.get('feed') as Feed) || 'hot';
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number, f: Feed) => {
    setLoading(true); setError(null);
    try {
      const data = await api.getPosts({ page: p, limit: 20, feed: f });
      setPosts((prev) => (p === 1 ? data.posts : [...prev, ...data.posts]));
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!isLoading) { setPage(1); void load(1, feed); } }, [feed, isLoading, user, load]);

  const tabs = [
    { id: 'hot' as Feed, label: <span className="flex items-center gap-1.5"><Flame size={14} /> Hot</span> },
    { id: 'new' as Feed, label: <span className="flex items-center gap-1.5"><Clock size={14} /> New</span> },
    { id: 'top' as Feed, label: <span className="flex items-center gap-1.5"><TrendingUp size={14} /> Top</span> },
    ...(user ? [{ id: 'subscribed' as Feed, label: <span className="flex items-center gap-1.5"><Users size={14} /> Following</span> }] : []),
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        {!isLoading && !user ? <Hero /> : null}
        <Tabs tabs={tabs} value={feed} onChange={(id) => router.push(id === 'hot' ? '/' : `/?feed=${id}`)} />
        {error ? <ErrorNotice message={error} onRetry={() => load(1, feed)} /> : null}
        {loading && !posts.length ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div> : null}
        {!loading && !posts.length && !error ? (
          <EmptyState icon={<Compass size={28} />} title={feed === 'subscribed' ? 'Your feed is empty' : 'Nothing here yet'} action={<ButtonLink href="/spaces" variant="primary">Explore spaces</ButtonLink>}>
            {feed === 'subscribed' ? 'Join a few spaces and their posts will show up here.' : 'Be the first to post, or find a space to join.'}
          </EmptyState>
        ) : null}
        <div className="space-y-3">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        {pagination && page < pagination.totalPages ? <div className="flex justify-center"><Button loading={loading} onClick={() => { const n = page + 1; setPage(n); void load(n, feed); }}>Load more</Button></div> : null}
      </div>
      <aside className="hidden space-y-4 xl:block">
        <PopularSpaces />
        <Card className="p-4 text-sm text-ink-2">
          <p className="font-semibold text-ink">Run your own space</p>
          <p className="mt-1">Anyone can start a community. You begin as its founder, and the members can elect more moderators.</p>
          <ButtonLink href="/spaces/create" variant="secondary" size="sm" className="mt-3">Create a space</ButtonLink>
        </Card>
      </aside>
    </div>
  );
}

export default function HomePage() {
  return <Suspense fallback={<Skeleton className="h-64 w-full" />}><HomeFeed /></Suspense>;
}
