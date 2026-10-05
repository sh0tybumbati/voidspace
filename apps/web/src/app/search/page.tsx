'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import type { Post, SpaceSummary } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Field';
import { EmptyState, ErrorNotice, Skeleton } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import PostCard from '@/components/posts/PostCard';

type Tab = 'all' | 'posts' | 'spaces' | 'users';
interface Found { posts: Post[]; spaces: SpaceSummary[]; users: { username: string; avatarUrl?: string | null; alignment?: number }[] }

function Results() {
  const params = useSearchParams();
  const router = useRouter();
  const q = (params.get('q') ?? '').trim();
  const [text, setText] = useState(q);
  const [tab, setTab] = useState<Tab>('all');
  useEffect(() => setText(q), [q]);
  const { data, error, loading, reload } = useAsync(() => api.search(q, tab, tab === 'all' ? 8 : 40) as Promise<Found>, [q, tab], { enabled: q.length > 0 });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(text.trim())}`); }} className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input aria-label="Search" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search posts, spaces and people" className="h-11 pl-10" />
      </form>
      {q ? <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All' }, { id: 'posts', label: 'Posts' }, { id: 'spaces', label: 'Spaces' }, { id: 'users', label: 'People' }]} /> : <EmptyState icon={<Search size={26} />} title="Search Voidspace">Find a discussion, a community, or a person.</EmptyState>}
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {q && loading && !data ? <Skeleton className="h-40 w-full" /> : null}
      {data && !data.posts?.length && !data.spaces?.length && !data.users?.length ? <EmptyState title={`Nothing found for "${q}"`}>Check the spelling, or try fewer words.</EmptyState> : null}
      {data?.spaces?.length ? (
        <section className="space-y-2"><h2 className="meta">Spaces</h2>
          {data.spaces.map((s) => <Link key={s.name} href={`/v/${s.name}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:border-line-strong"><Avatar name={s.name} size={34} /><div className="min-w-0 flex-1"><p className="font-semibold">v/{s.name}</p><p className="truncate text-xs text-muted">{s.description || s.displayName}</p></div><span className="flex items-center gap-1 font-mono text-xs text-muted"><Users size={11} /> {s.subscriberCount}</span></Link>)}
        </section>
      ) : null}
      {data?.users?.length ? (
        <section className="space-y-2"><h2 className="meta">People</h2>
          {data.users.map((u) => <Link key={u.username} href={`/u/${u.username}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:border-line-strong"><Avatar name={u.username} src={api.assetUrl(u.avatarUrl)} size={34} /><span className="font-semibold">{u.username}</span></Link>)}
        </section>
      ) : null}
      {data?.posts?.length ? <section className="space-y-3"><h2 className="meta">Posts</h2>{data.posts.map((p) => <PostCard key={p.id} post={p} />)}</section> : null}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<Skeleton className="h-40 w-full" />}><Results /></Suspense>;
}
