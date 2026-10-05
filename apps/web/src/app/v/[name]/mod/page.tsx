'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCheck, Flag, Gavel, ShieldX } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync } from '@/lib/hooks';
import type { AppealView, ReportGroup } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import { AppealReviewModal } from '@/components/moderation/AppealReview';

type Tab = 'reports' | 'appeals' | 'bans';
type Filter = 'pending' | 'resolved';

function ReportRow({ g, space, onChange }: { g: ReportGroup; space: string; onChange: () => void }) {
  const [mode, setMode] = useState<null | 'remove' | 'dismiss'>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const t = g.target;
  const link = g.targetType === 'post' ? `/v/${space}/${g.targetId}` : null;

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/api/mod/reports/resolve', { targetType: g.targetType, targetId: g.targetId, action: mode, ...(mode === 'remove' ? { reason: text.trim() } : { note: text.trim() || undefined }) });
      toast.success(mode === 'remove' ? 'Removed and logged publicly.' : 'Reports dismissed.');
      setMode(null); setText(''); onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not resolve.'); }
    finally { setBusy(false); }
  };

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone="warn"><Flag size={10} /> {g.count} {g.count === 1 ? 'report' : 'reports'}</Badge>{g.categories.map((c) => <Badge key={c}>{c.replace('_', ' ')}</Badge>)}<TimeAgo date={g.latestAt} /></div>
      <div className="mt-2.5 rounded border border-line bg-surface-2 p-3">
        {t ? (<>
          <p className="text-xs text-muted">{g.targetType} by <Link href={`/u/${t.author.username}`} className="hover:underline">{t.author.username}</Link>{t.removed ? ' · already removed' : ''}</p>
          {t.title ? <p className="mt-1 font-semibold">{link ? <Link href={link} className="hover:text-accent-text">{t.title}</Link> : t.title}</p> : null}
          {t.content ? <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-ink-2">{t.content}</p> : null}
        </>) : <p className="text-sm text-muted">The content no longer exists.</p>}
      </div>
      <ul className="mt-2.5 space-y-1 text-xs text-ink-2">{g.reports.slice(0, 4).map((r) => <li key={r.id}><b className="text-ink">{r.reporter}</b>: {r.reason}</li>)}{g.reports.length > 4 ? <li className="text-muted">and {g.reports.length - 4} more</li> : null}</ul>
      {t && !t.removed ? <div className="mt-3 flex gap-2"><Button size="sm" variant="danger" onClick={() => setMode('remove')}><ShieldX size={14} /> Remove</Button><Button size="sm" onClick={() => setMode('dismiss')}><CheckCheck size={14} /> Dismiss reports</Button></div> : null}
      <Modal open={Boolean(mode)} onClose={() => setMode(null)} title={mode === 'remove' ? 'Remove and log publicly' : 'Dismiss these reports'}>
        <Field label={mode === 'remove' ? 'Reason (at least 10 characters, public)' : 'Note (optional)'}>{(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} />}</Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button><Button variant={mode === 'remove' ? 'danger' : 'primary'} loading={busy} disabled={mode === 'remove' && text.trim().length < 10} onClick={submit}>{mode === 'remove' ? 'Remove' : 'Dismiss'}</Button></div>
      </Modal>
    </article>
  );
}

function AppealRow({ a, onChange }: { a: AppealView; onChange: () => void }) {
  const [decision, setDecision] = useState<null | 'approve' | 'deny' | 'escalate'>(null);
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone={a.status === 'pending' ? 'warn' : a.status === 'approved' ? 'ok' : a.status === 'escalated' ? 'info' : 'neutral'}>{a.status}</Badge><span>from <b className="text-ink-2">{a.appellant}</b></span><TimeAgo date={a.createdAt} /></div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-line bg-surface-2 p-3"><p className="meta">The moderation</p><p className="mt-1 text-sm"><b>{(a.action.type ?? '').replace('_', ' ')}</b> by {a.action.by}</p><p className="mt-1 text-sm text-ink-2">{a.action.reason}</p></div>
        <div className="rounded border border-line bg-surface-2 p-3"><p className="meta">Their appeal</p><p className="mt-1 whitespace-pre-line text-sm text-ink-2">{a.reason}</p></div>
      </div>
      {a.reviewerNotes ? <p className="mt-3 text-xs text-muted">Reviewer{a.reviewer ? ` ${a.reviewer}` : ''}: {a.reviewerNotes}</p> : null}
      {a.status === 'pending' ? (
        a.canReview ? (
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={() => setDecision('approve')}>Approve</Button><Button size="sm" variant="danger" onClick={() => setDecision('deny')}>Deny</Button><Button size="sm" onClick={() => setDecision('escalate')}>Escalate to admins</Button></div>
        ) : <p className="mt-3 text-xs text-warn">You took this action, so another moderator must review the appeal.</p>
      ) : null}
      {decision ? <AppealReviewModal appeal={a} decision={decision} onClose={() => setDecision(null)} onDone={onChange} /> : null}
    </article>
  );
}

function ModQueue() {
  const { name } = useParams<{ name: string }>();
  const initial = useSearchParams().get('tab');
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(initial === 'appeals' || initial === 'bans' ? initial : 'reports');
  const [filter, setFilter] = useState<Filter>('pending');
  const reports = useAsync(() => api.get<{ items: ReportGroup[] }>(`/api/mod/spaces/${name}/reports?status=${filter}`), [name, filter, user?.id], { enabled: tab === 'reports' && Boolean(user) });
  const appeals = useAsync(() => api.get<{ appeals: AppealView[] }>(`/api/mod/spaces/${name}/appeals?status=${filter === 'pending' ? 'pending' : 'resolved'}`), [name, filter, user?.id], { enabled: tab === 'appeals' && Boolean(user) });
  const bans = useAsync(() => api.get<{ bans: { id: string; reason: string; createdAt: string; expiresAt: string | null; user: { username: string } }[] }>(`/api/mod/${name}/bans`), [name, user?.id], { enabled: tab === 'bans' && Boolean(user) });

  const unban = async (username: string) => {
    try { await api.post('/api/mod/unban-user', { username, spaceName: name }); toast.success(`${username} was unbanned.`); void bans.reload(); } catch (e) { toast.error((e as Error).message); }
  };

  if (!user) return <EmptyState title="Sign in to see the mod queue" action={<Link href={`/login?redirect=/v/${name}/mod`} className="link">Sign in</Link>} />;
  const active = tab === 'reports' ? reports : tab === 'appeals' ? appeals : bans;
  const forbidden = active.error && /moderator|forbidden/i.test(active.error);
  if (forbidden) return <EmptyState icon={<Gavel size={28} />} title="Moderators only" action={<Link href={`/v/${name}/governance`} className="link">See how moderators are chosen</Link>}>You can stand for election in the governance page.</EmptyState>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header><p className="meta"><Link href={`/v/${name}`} className="hover:text-ink">v/{name}</Link> / mod</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Mod queue</h1></header>
      <Tabs tabs={[{ id: 'reports', label: 'Reports' }, { id: 'appeals', label: 'Appeals' }, { id: 'bans', label: 'Bans' }]} value={tab} onChange={setTab} />
      {tab !== 'bans' ? (
        <div className="flex gap-1 text-sm">{(['pending', 'resolved'] as Filter[]).map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded px-3 py-1 font-medium capitalize ${filter === f ? 'bg-surface-3 text-ink' : 'text-muted hover:text-ink'}`}>{f === 'pending' ? 'Waiting' : 'Done'}</button>)}</div>
      ) : null}
      {active.error ? <ErrorNotice message={active.error} onRetry={active.reload} /> : null}
      {active.loading && !active.data ? <Skeleton className="h-40 w-full" /> : null}

      {tab === 'reports' ? <>{reports.data && !reports.data.items.length ? <EmptyState icon={<CheckCheck size={28} />} title="All clear">No {filter === 'pending' ? 'open' : 'resolved'} reports.</EmptyState> : null}<div className="space-y-3">{reports.data?.items.map((g) => <ReportRow key={g.targetId} g={g} space={name} onChange={reports.reload} />)}</div></> : null}
      {tab === 'appeals' ? <>{appeals.data && !appeals.data.appeals.length ? <EmptyState icon={<Gavel size={28} />} title="No appeals">Nothing {filter === 'pending' ? 'is waiting for review' : 'has been decided yet'}.</EmptyState> : null}<div className="space-y-3">{appeals.data?.appeals.map((a) => <AppealRow key={a.id} a={a} onChange={appeals.reload} />)}</div></> : null}
      {tab === 'bans' ? <>{bans.data && !bans.data.bans.length ? <EmptyState title="No active bans" /> : null}<div className="space-y-2">{bans.data?.bans.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3"><div className="min-w-0 flex-1"><p className="font-semibold">{b.user.username}</p><p className="text-sm text-ink-2">{b.reason}</p><p className="meta mt-1">{b.expiresAt ? `until ${new Date(b.expiresAt).toLocaleDateString()}` : 'permanent'}</p></div><Button size="sm" onClick={() => unban(b.user.username)}>Unban</Button></div>
      ))}</div></> : null}
    </div>
  );
}

export default function ModQueuePage() {
  return <Suspense fallback={<Skeleton className="h-40 w-full" />}><ModQueue /></Suspense>;
}
