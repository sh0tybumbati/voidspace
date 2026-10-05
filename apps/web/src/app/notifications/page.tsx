'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { useAsync } from '@/lib/hooks';
import { useLive } from '@/lib/live';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { unread, setUnread, onNotification } = useLive();
  const { data, error, loading, reload, setData } = useAsync(() => api.get<{ notifications: Notification[]; unreadCount: number }>('/api/notifications?limit=50'), [user?.id], { enabled: Boolean(user) });

  useEffect(() => onNotification(() => void reload()), [onNotification, reload]);

  if (!isLoading && !user) return <EmptyState title="Sign in to see notifications" action={<Link href="/login?redirect=/notifications" className="link">Sign in</Link>} />;

  const open = async (n: Notification) => {
    if (!n.readAt) {
      setData((d) => (d ? { ...d, notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) } : d));
      setUnread((c) => Math.max(0, c - 1));
      void api.post('/api/notifications/read', { ids: [n.id] }).catch(() => undefined);
    }
    if (n.link) router.push(n.link);
  };
  const markAll = async () => { await api.post('/api/notifications/read', { all: true }); setUnread(0); void reload(); };

  return (
    <div className="max-w-2xl space-y-5">
      <header className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Bell size={22} className="text-accent-text" /> Notifications</h1>{unread > 0 ? <Button size="sm" onClick={markAll}><CheckCheck size={14} /> Mark all read</Button> : null}</header>
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div> : null}
      {data && !data.notifications.length ? <EmptyState icon={<Bell size={28} />} title="Quiet out here">Replies, moderation decisions, appeals and votes land here the moment they happen.</EmptyState> : null}
      <ul className="space-y-1.5">
        {data?.notifications.map((n) => (
          <li key={n.id}>
            <button onClick={() => open(n)} className={cn('flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition hover:border-line-strong', n.readAt ? 'border-line bg-surface' : 'border-accent/40 bg-accent/5')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent')} aria-label={n.readAt ? undefined : 'Unread'} />
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{n.title}</span>{n.body ? <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2">{n.body}</span> : null}<TimeAgo date={n.createdAt} className="mt-1 block text-xs text-muted" /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
