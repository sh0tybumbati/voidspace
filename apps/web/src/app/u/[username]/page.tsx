'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Crown, Settings, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync } from '@/lib/hooks';
import type { Pagination, Post } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import PostCard from '@/components/posts/PostCard';

interface Profile {
  username: string; avatarUrl?: string | null; bio?: string | null; createdAt: string; alignment: number;
  karma: { total: number; post: number; comment: number }; postCount: number; commentCount: number;
  moderatorOf: { name: string; displayName: string; isFounder: boolean }[];
}
interface UserComment { id: string; content: string; voteScore: number; createdAt: string; removed?: boolean; post: { id: string; title: string; space: { name: string } } }
type Tab = 'posts' | 'comments';

function Stat({ label, value }: { label: string; value: number }) {
  return <div><p className="font-mono text-lg font-bold">{value.toLocaleString()}</p><p className="meta">{label}</p></div>;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('posts');
  const [page, setPage] = useState(1);
  const profile = useAsync(() => api.getUserProfile(username).then((r) => r.user as Profile), [username]);
  const list = useAsync(
    () => (tab === 'posts' ? api.getUserPosts(username, page, 20) : api.getUserComments(username, page, 20)) as Promise<{ posts?: Post[]; comments?: UserComment[]; pagination: Pagination }>,
    [username, tab, page, user?.id],
    { enabled: Boolean(profile.data) },
  );

  if (profile.error) return <EmptyState title="User not found">{profile.error}</EmptyState>;
  const p = profile.data;
  if (!p) return <Skeleton className="mx-auto h-48 max-w-4xl" />;
  const own = user?.username === p.username;
  const items = tab === 'posts' ? list.data?.posts : list.data?.comments;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4 lg:order-1">
        <Tabs<Tab> value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ id: 'posts', label: 'Posts', count: p.postCount }, { id: 'comments', label: 'Comments', count: p.commentCount }]} />
        {list.error ? <ErrorNotice message={list.error} onRetry={list.reload} /> : null}
        {list.loading && !list.data ? <Skeleton className="h-32 w-full" /> : null}
        {list.data && !items?.length ? <EmptyState title={`No ${tab} yet`} /> : null}
        {tab === 'posts' ? <div className="space-y-3">{list.data?.posts?.map((x) => <PostCard key={x.id} post={x} />)}</div> : (
          <div className="space-y-2">
            {list.data?.comments?.map((c) => (
              <Link key={c.id} href={`/v/${c.post.space.name}/${c.post.id}`} className="block rounded-lg border border-line bg-surface p-4 transition hover:border-line-strong">
                <p className="meta">on {c.post.title} in v/{c.post.space.name} <TimeAgo date={c.createdAt} /></p>
                <p className="mt-1.5 line-clamp-3 text-sm text-ink-2">{c.removed ? '[removed]' : c.content}</p>
                <p className="mt-1 font-mono text-xs text-muted">{c.voteScore} points</p>
              </Link>
            ))}
          </div>
        )}
        {list.data && list.data.pagination.totalPages > 1 ? <div className="flex items-center justify-center gap-3"><Button size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Newer</Button><span className="font-mono text-xs text-muted">{page} / {list.data.pagination.totalPages}</span><Button size="sm" disabled={page >= list.data.pagination.totalPages} onClick={() => setPage((n) => n + 1)}>Older</Button></div> : null}
      </div>

      <aside className="space-y-4 lg:order-2">
        <Card className="p-5">
          <div className="flex items-center gap-3"><Avatar name={p.username} src={api.assetUrl(p.avatarUrl)} size={56} /><div className="min-w-0"><h1 className="truncate text-xl font-bold">{p.username}</h1><p className="flex items-center gap-1 text-xs text-muted"><CalendarDays size={12} /> Joined <TimeAgo date={p.createdAt} /></p></div></div>
          {p.bio ? <p className="mt-3 whitespace-pre-wrap text-sm text-ink-2">{p.bio}</p> : null}
          <div className="mt-4 grid grid-cols-3 gap-2"><Stat label="Karma" value={p.karma.total} /><Stat label="Posts" value={p.postCount} /><Stat label="Comments" value={p.commentCount} /></div>
          <div className="mt-4 flex items-center justify-between rounded border border-line bg-surface-2 px-3 py-2"><span className="meta" title="Earned from how the community votes on this person's posts and comments">Alignment</span><span className={`font-mono text-sm font-bold ${p.alignment > 0 ? 'text-ok' : p.alignment < 0 ? 'text-danger' : 'text-muted'}`}>{p.alignment > 0 ? '+' : ''}{p.alignment}</span></div>
          {own ? <ButtonLink href="/settings" variant="outline" size="sm" className="mt-4 w-full"><Settings size={14} /> Edit profile</ButtonLink> : null}
        </Card>
        {p.moderatorOf.length ? (
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Shield size={14} /> Moderates</span>} />
            <ul className="p-2">{p.moderatorOf.map((s) => <li key={s.name}><Link href={`/v/${s.name}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2"><Avatar name={s.name} size={22} /><span className="flex-1 truncate">v/{s.name}</span>{s.isFounder ? <Badge tone="accent"><Crown size={10} /> founder</Badge> : null}</Link></li>)}</ul>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
