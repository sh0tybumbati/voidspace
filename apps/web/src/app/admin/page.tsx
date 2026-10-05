'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync, useDebounced } from '@/lib/hooks';
import type { AppealView } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import { AppealReviewModal } from '@/components/moderation/AppealReview';

type Tab = 'overview' | 'users' | 'reports' | 'appeals' | 'publish';
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
const JUSTIFICATION_HINT = 'Public. Anyone can read this on the transparency page. At least 20 characters.';

/** Asks for the public justification every admin action needs, then runs it. */
function JustifyModal({ title, intro, confirm, danger, onClose, onSubmit }: { title: string; intro?: string; confirm: string; danger?: boolean; onClose: () => void; onSubmit: (justification: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await onSubmit(text.trim()); onClose(); } catch (e) { toast.error(msg(e)); } finally { setBusy(false); } };
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        {intro ? <p className="text-sm text-ink-2">{intro}</p> : null}
        <Field label="Justification" hint={JUSTIFICATION_HINT}>{(id) => <Textarea id={id} rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} />}</Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={text.trim().length < 20} onClick={go}>{confirm}</Button></div>
      </div>
    </Modal>
  );
}

function Overview() {
  const { data, error } = useAsync(() => api.getAdminStats() as Promise<{ stats: Record<string, number> }>, []);
  if (error) return <ErrorNotice message={error} />;
  if (!data) return <Skeleton className="h-32 w-full" />;
  const labels: [string, string][] = [['totalUsers', 'Users'], ['recentSignups', 'Signups, 30 days'], ['totalPosts', 'Posts'], ['totalComments', 'Comments'], ['totalSpaces', 'Spaces'], ['bannedUsers', 'Banned'], ['adminUsers', 'Admins']];
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{labels.map(([k, l]) => <div key={k} className="rounded-lg border border-line bg-surface p-4"><p className="font-mono text-2xl font-bold">{data.stats[k] ?? 0}</p><p className="meta mt-1">{l}</p></div>)}</div>;
}

interface AdminUser { id: string; username: string; email: string; isAdmin: boolean; banned: boolean; createdAt: string; stats: { postCount: number; commentCount: number; totalKarma: number } }

function Users() {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const { data, error, loading, reload } = useAsync(() => api.getAdminUsers(1, 50, search || undefined) as Promise<{ users: AdminUser[] }>, [search]);
  const [pending, setPending] = useState<{ u: AdminUser; change: { banned?: boolean; isAdmin?: boolean }; label: string } | null>(null);
  return (
    <div className="space-y-3">
      <Input aria-label="Search users" placeholder="Search by username or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <Skeleton className="h-40 w-full" /> : null}
      <div className="overflow-hidden rounded-lg border border-line">
        {data?.users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1"><Link href={`/u/${u.username}`} className="font-semibold hover:underline">{u.username}</Link> {u.isAdmin ? <Badge tone="accent">admin</Badge> : null} {u.banned ? <Badge tone="danger">banned</Badge> : null}<p className="truncate font-mono text-xs text-muted">{u.email} · {u.stats.postCount} posts · {u.stats.commentCount} comments</p></div>
            {u.id !== me?.id ? (
              <div className="flex gap-2">
                <Button size="sm" variant={u.banned ? 'secondary' : 'danger'} onClick={() => setPending({ u, change: { banned: !u.banned }, label: u.banned ? 'Unban' : 'Ban' })}>{u.banned ? 'Unban' : 'Ban'}</Button>
                <Button size="sm" onClick={() => setPending({ u, change: { isAdmin: !u.isAdmin }, label: u.isAdmin ? 'Remove admin' : 'Make admin' })}>{u.isAdmin ? 'Remove admin' : 'Make admin'}</Button>
              </div>
            ) : <span className="meta">you</span>}
          </div>
        ))}
      </div>
      {pending ? <JustifyModal title={`${pending.label}: ${pending.u.username}`} intro="This is recorded in the public admin log under your name." confirm={pending.label} danger={pending.change.banned === true} onClose={() => setPending(null)} onSubmit={async (justification) => { await api.patch(`/api/admin/users/${pending.u.id}`, { ...pending.change, justification }); toast.success('Done.'); void reload(); }} /> : null}
    </div>
  );
}

interface SiteReport { id: string; targetType: 'post' | 'comment' | 'user'; targetId: string; category: string; reason?: string | null; reporter: string; space: string | null; createdAt: string }

function Reports() {
  const { data, error, loading, reload } = useAsync(() => api.get<{ reports: SiteReport[] }>('/api/admin/reports'), []);
  const [pending, setPending] = useState<{ r: SiteReport; action: 'remove' | 'ban' | 'dismiss' } | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">Reports about accounts, and anything reported as illegal. Ordinary rule-breaking goes to each space&apos;s moderators instead.</p>
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <Skeleton className="h-24 w-full" /> : null}
      {data && !data.reports.length ? <EmptyState title="No open site reports" /> : null}
      {data?.reports.map((r) => (
        <div key={r.id} className="rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone="warn">{r.category}</Badge><span className="font-mono">{r.targetType} {r.targetId.slice(0, 8)}</span>{r.space ? <span>v/{r.space}</span> : null}<span>by {r.reporter}</span><TimeAgo date={r.createdAt} /></div>
          {r.reason ? <p className="mt-2 text-sm text-ink-2">{r.reason}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {r.targetType === 'user' ? <Button size="sm" variant="danger" onClick={() => setPending({ r, action: 'ban' })}>Ban account</Button> : <Button size="sm" variant="danger" onClick={() => setPending({ r, action: 'remove' })}>Remove content</Button>}
            <Button size="sm" onClick={() => setPending({ r, action: 'dismiss' })}>Dismiss</Button>
          </div>
        </div>
      ))}
      {pending ? <JustifyModal title={`${pending.action === 'dismiss' ? 'Dismiss' : pending.action === 'ban' ? 'Ban' : 'Remove'}: ${pending.r.targetType}`} confirm="Confirm" danger={pending.action !== 'dismiss'} onClose={() => setPending(null)} onSubmit={async (justification) => { await api.post('/api/admin/reports/resolve', { targetType: pending.r.targetType, targetId: pending.r.targetId, action: pending.action, justification }); toast.success('Resolved.'); void reload(); }} /> : null}
    </div>
  );
}

function Appeals() {
  const { data, error, loading, reload } = useAsync(() => api.get<{ appeals: (AppealView & { escalatedAt: string })[] }>('/api/appeals/admin/escalated'), []);
  const [review, setReview] = useState<{ a: AppealView; decision: 'approve' | 'deny' } | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">Appeals a space&apos;s moderators could not or would not settle. Your decision and your reasoning are published.</p>
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <Skeleton className="h-24 w-full" /> : null}
      {data && !data.appeals.length ? <EmptyState title="No escalated appeals" /> : null}
      {data?.appeals.map((a) => (
        <div key={a.id} className="rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone="info">v/{a.space}</Badge><span>{a.appellant} appeals</span><TimeAgo date={a.escalatedAt} /></div>
          <p className="mt-2 text-sm"><b>{(a.action.type ?? '').replace('_', ' ')}</b> by {a.action.by}: <span className="text-ink-2">{a.action.reason}</span></p>
          <p className="mt-2 rounded border border-line bg-surface-2 p-3 text-sm text-ink-2">{a.reason}</p>
          {a.reviewerNotes ? <p className="mt-2 text-xs text-muted">Moderator note: {a.reviewerNotes}</p> : null}
          <div className="mt-3 flex gap-2"><Button size="sm" variant="primary" onClick={() => setReview({ a: { ...a, createdAt: a.escalatedAt }, decision: 'approve' })}>Approve</Button><Button size="sm" variant="danger" onClick={() => setReview({ a: { ...a, createdAt: a.escalatedAt }, decision: 'deny' })}>Deny</Button></div>
        </div>
      ))}
      {review ? <AppealReviewModal admin appeal={review.a} decision={review.decision} onClose={() => setReview(null)} onDone={reload} /> : null}
    </div>
  );
}

function Publish() {
  const [n, setN] = useState({ noticeType: 'dmca', jurisdiction: '', dateReceived: new Date().toISOString().slice(0, 10), actionTaken: '', publicSummary: '' });
  const [c, setC] = useState({ statement: 'As of today, Voidspace has not received any secret court orders, gag orders or government requests for user data.', validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) });
  const [busy, setBusy] = useState<'n' | 'c' | null>(null);
  const run = async (which: 'n' | 'c', fn: () => Promise<unknown>, done: string) => { setBusy(which); try { await fn(); toast.success(done); } catch (e) { toast.error(msg(e)); } finally { setBusy(null); } };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="space-y-3 rounded-lg border border-line bg-surface p-5" onSubmit={(e) => { e.preventDefault(); void run('n', () => api.post('/api/admin/legal-notices', { ...n, publicSummary: n.publicSummary || undefined }), 'Notice published.').then(() => setN({ ...n, jurisdiction: '', actionTaken: '', publicSummary: '' })); }}>
        <h2 className="font-semibold">Publish a legal notice</h2>
        <Field label="Type">{(id) => <Select id={id} value={n.noticeType} onChange={(e) => setN({ ...n, noticeType: e.target.value })}><option value="dmca">DMCA takedown</option><option value="court_order">Court order</option><option value="government_request">Government request</option><option value="other">Other</option></Select>}</Field>
        <Field label="Jurisdiction">{(id) => <Input id={id} value={n.jurisdiction} onChange={(e) => setN({ ...n, jurisdiction: e.target.value })} />}</Field>
        <Field label="Date received">{(id) => <Input id={id} type="date" value={n.dateReceived} onChange={(e) => setN({ ...n, dateReceived: e.target.value })} />}</Field>
        <Field label="What we did" hint="At least 10 characters.">{(id) => <Textarea id={id} rows={3} value={n.actionTaken} onChange={(e) => setN({ ...n, actionTaken: e.target.value })} />}</Field>
        <Field label="Public summary (optional)">{(id) => <Textarea id={id} rows={2} value={n.publicSummary} onChange={(e) => setN({ ...n, publicSummary: e.target.value })} />}</Field>
        <Button type="submit" variant="primary" loading={busy === 'n'} disabled={n.jurisdiction.length < 2 || n.actionTaken.length < 10}>Publish notice</Button>
      </form>
      <form className="space-y-3 rounded-lg border border-line bg-surface p-5" onSubmit={(e) => { e.preventDefault(); void run('c', () => api.post('/api/admin/canary', c), 'Canary signed.'); }}>
        <h2 className="font-semibold">Sign the warrant canary</h2>
        <Field label="Statement" hint="At least 20 characters.">{(id) => <Textarea id={id} rows={5} value={c.statement} onChange={(e) => setC({ ...c, statement: e.target.value })} />}</Field>
        <Field label="Valid until" hint="Renew before this date or readers should assume the worst.">{(id) => <Input id={id} type="date" value={c.validUntil} onChange={(e) => setC({ ...c, validUntil: e.target.value })} />}</Field>
        <Button type="submit" variant="primary" loading={busy === 'c'} disabled={c.statement.length < 20}>Sign canary</Button>
      </form>
    </div>
  );
}

function AdminPanel() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'overview';
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!user?.isAdmin) return <EmptyState title="Admins only">This page is for site administrators.</EmptyState>;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck size={22} className="text-accent-text" /> Admin</h1><p className="mt-1 text-sm text-ink-2">Everything you do here is logged in public with the reason you give.</p></header>
      <Tabs<Tab> value={tab} onChange={(t) => router.push(t === 'overview' ? '/admin' : `/admin?tab=${t}`)} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'users', label: 'Users' }, { id: 'reports', label: 'Site reports' }, { id: 'appeals', label: 'Escalated appeals' }, { id: 'publish', label: 'Notices and canary' }]} />
      {tab === 'overview' ? <Overview /> : tab === 'users' ? <Users /> : tab === 'reports' ? <Reports /> : tab === 'appeals' ? <Appeals /> : <Publish />}
    </div>
  );
}

export default function AdminPage() {
  return <Suspense fallback={<Skeleton className="h-40 w-full" />}><AdminPanel /></Suspense>;
}
