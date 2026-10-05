'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Eye, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';

type Tab = 'overview' | 'admin' | 'legal' | 'mod';
interface Canary { status: 'none' | 'valid' | 'expired'; statement: string | null; validUntil: string | null; signedAt: string | null; daysLeft: number | null }
interface Summary { last30Days: { modActions: number; adminActions: number }; legalNotices: number; appeals: Record<string, number>; governance: { activeElections: number; activeVotes: number }; spaces: number; canary: Canary }
interface Pg { page: number; totalPages: number }

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-line bg-surface p-4"><p className="font-mono text-2xl font-bold">{value}</p><p className="meta mt-1">{label}</p></div>;
}

function CanaryCard({ c }: { c: Canary }) {
  const Icon = c.status === 'valid' ? ShieldCheck : c.status === 'expired' ? ShieldAlert : ShieldQuestion;
  const tone = c.status === 'valid' ? 'text-ok border-ok/40' : c.status === 'expired' ? 'text-danger border-danger/40' : 'text-muted border-line';
  return (
    <Card className={`border p-5 ${tone}`}>
      <div className="flex items-center gap-3"><Icon size={26} /><div><p className="text-base font-semibold text-ink">Warrant canary: {c.status === 'none' ? 'not yet published' : c.status}</p>{c.validUntil ? <p className="text-xs text-muted">{c.status === 'valid' ? `Valid for ${c.daysLeft} more days, until ${new Date(c.validUntil).toLocaleDateString()}` : `Expired ${new Date(c.validUntil).toLocaleDateString()}`}</p> : null}</div></div>
      {c.statement ? <p className="mt-3 text-sm text-ink-2">{c.statement}</p> : <p className="mt-3 text-sm text-muted">The admins have not signed a canary statement yet.</p>}
      <p className="mt-3 text-xs text-muted">A canary says &quot;we have not received any secret orders.&quot; If it is not renewed on time, assume the worst.</p>
    </Card>
  );
}

function Paged<T>({ path, field, render, empty }: { path: string; field: string; render: (x: T) => React.ReactNode; empty: string }) {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => api.get<Record<string, any>>(`${path}?page=${page}&limit=25`), [path, page]);
  const rows: T[] = data?.[field] ?? [];
  const pg: Pg | undefined = data?.pagination;
  return (
    <div className="space-y-2">
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />) : null}
      {data && !rows.length ? <EmptyState title={empty} /> : null}
      {rows.map(render)}
      {pg && pg.totalPages > 1 ? <div className="flex items-center justify-center gap-3 pt-2"><Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button><span className="font-mono text-xs text-muted">{page} / {pg.totalPages}</span><Button size="sm" disabled={page >= pg.totalPages} onClick={() => setPage((p) => p + 1)}>Older</Button></div> : null}
    </div>
  );
}

export default function TransparencyPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const { data, error, reload } = useAsync(() => api.get<Summary>('/api/transparency/summary'), []);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Eye size={22} className="text-accent-text" /> Transparency</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">What the people who run this site and its communities have done, in public. Admin actions need a written justification. Legal requests are published with what we did about them.</p>
      </header>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'admin', label: 'Admin actions' }, { id: 'legal', label: 'Legal notices', count: data?.legalNotices }, { id: 'mod', label: 'Moderator actions' }]} />

      {tab === 'overview' ? (
        <div className="space-y-4">
          {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
          {!data && !error ? <Skeleton className="h-48 w-full" /> : null}
          {data ? (
            <>
              <CanaryCard c={data.canary} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Mod actions, 30 days" value={data.last30Days.modActions} />
                <Stat label="Admin actions, 30 days" value={data.last30Days.adminActions} />
                <Stat label="Legal notices, ever" value={data.legalNotices} />
                <Stat label="Spaces" value={data.spaces} />
                <Stat label="Open elections" value={data.governance.activeElections} />
                <Stat label="Open community votes" value={data.governance.activeVotes} />
                <Stat label="Appeals approved" value={data.appeals.approved ?? 0} />
                <Stat label="Appeals denied" value={data.appeals.denied ?? 0} />
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'admin' ? (
        <Paged<{ id: string; admin: string; actionType: string; targetType: string; justification: string; createdAt: string }> path="/api/transparency/admin-actions" field="actions" empty="No admin actions yet" render={(a) => (
          <div key={a.id} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Badge tone="accent">{a.actionType.replace(/_/g, ' ')}</Badge><span className="text-sm">by <Link href={`/u/${a.admin}`} className="font-semibold hover:underline">{a.admin}</Link></span><span className="meta">{a.targetType}</span><TimeAgo date={a.createdAt} className="text-xs text-muted" /></div>
            <p className="mt-1.5 text-sm text-ink-2">{a.justification}</p>
          </div>
        )} />
      ) : null}

      {tab === 'legal' ? (
        <Paged<{ id: string; noticeType: string; jurisdiction: string; dateReceived: string; actionTaken: string; publicSummary?: string | null }> path="/api/transparency/legal-notices" field="notices" empty="No legal notices have been received" render={(n) => (
          <div key={n.id} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Badge tone="warn">{n.noticeType.replace(/_/g, ' ')}</Badge><span className="text-sm font-semibold">{n.jurisdiction}</span><span className="text-xs text-muted">received {new Date(n.dateReceived).toLocaleDateString()}</span></div>
            {n.publicSummary ? <p className="mt-1.5 text-sm text-ink-2">{n.publicSummary}</p> : null}
            <p className="mt-1.5 text-sm"><span className="meta">What we did</span><br />{n.actionTaken}</p>
          </div>
        )} />
      ) : null}

      {tab === 'mod' ? (
        <Paged<{ id: string; space: string; moderator: string; actionType: string; reason: string; createdAt: string; reversedAt?: string | null }> path="/api/transparency/mod-actions" field="actions" empty="No moderator actions yet" render={(a) => (
          <div key={a.id} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Badge>{a.actionType.replace(/_/g, ' ')}</Badge><Link href={`/v/${a.space}/modlog`} className="text-sm font-semibold hover:underline">v/{a.space}</Link><span className="text-sm text-muted">by {a.moderator}</span><TimeAgo date={a.createdAt} className="text-xs text-muted" />{a.reversedAt ? <Badge tone="info">reversed</Badge> : null}</div>
            <p className="mt-1.5 text-sm text-ink-2">{a.reason}</p>
          </div>
        )} />
      ) : null}
    </div>
  );
}
