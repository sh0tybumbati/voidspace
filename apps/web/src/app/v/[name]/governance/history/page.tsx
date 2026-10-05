'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import type { CommunityVoteView, ElectionView, Pagination } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorNotice, Skeleton } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import { CommunityVoteCard, ElectionCard } from '@/components/governance/Cards';

type Kind = 'all' | 'elections' | 'votes';
type Outcome = 'all' | 'passed' | 'failed';
type Item = ({ kind: 'election' } & ElectionView | { kind: 'vote' } & CommunityVoteView) & { closedAt: string; turnout: number };
interface History {
  space: { name: string; displayName: string };
  summary: { total: number; passed: number; failed: number; withdrawn: number; averageTurnout: number | null; elections: number; votes: number };
  items: Item[];
  pagination: Pagination;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className="rounded-lg border border-line bg-surface p-4"><p className="font-mono text-2xl font-bold tabular">{value}</p><p className="meta mt-1">{label}</p>{sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}</div>;
}

export default function GovernanceHistoryPage() {
  const { name } = useParams<{ name: string }>();
  const [kind, setKind] = useState<Kind>('all');
  const [outcome, setOutcome] = useState<Outcome>('all');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => api.get<History>(`/api/spaces/${name}/governance/history?kind=${kind}&outcome=${outcome}&page=${page}&limit=10`), [name, kind, outcome, page]);
  const s = data?.summary;

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="meta"><Link href={`/v/${name}`} className="hover:text-ink">v/{name}</Link> / <Link href={`/v/${name}/governance`} className="hover:text-ink">governance</Link> / history</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><History size={22} className="text-accent-text" /> Decision history</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">Every election and community vote this space has held, with the final count. Votes still open are on the <Link href={`/v/${name}/governance`} className="link">governance page</Link>, and stay hidden until they close.</p>
      </header>

      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {!data && loading ? <Skeleton className="h-24 w-full" /> : null}

      {s ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Decisions" value={s.total} sub={`${s.elections} ${s.elections === 1 ? 'election' : 'elections'}, ${s.votes} ${s.votes === 1 ? 'vote' : 'votes'}`} />
          <Tile label="Passed" value={s.passed} />
          <Tile label="Did not pass" value={s.failed} sub={s.withdrawn ? `${s.withdrawn} withdrawn` : undefined} />
          <Tile label="Average turnout" value={s.averageTurnout === null ? 'n/a' : pct(s.averageTurnout)} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs<Kind> value={kind} onChange={(k) => { setKind(k); setPage(1); }} tabs={[{ id: 'all', label: 'Everything' }, { id: 'elections', label: 'Elections' }, { id: 'votes', label: 'Votes' }]} />
        <Tabs<Outcome> value={outcome} onChange={(o) => { setOutcome(o); setPage(1); }} tabs={[{ id: 'all', label: 'Any result' }, { id: 'passed', label: 'Passed' }, { id: 'failed', label: 'Did not pass' }]} />
      </div>

      {data && !data.items.length ? <EmptyState icon={<History size={26} />} title={s?.total ? 'Nothing matches those filters' : 'No decisions yet'}>{s?.total ? 'Try a different filter.' : 'When a vote or election finishes, it is kept here for good.'}</EmptyState> : null}

      <ol className="relative space-y-6 border-l border-line pl-6 sm:pl-8">
        {data?.items.map((it) => (
          <li key={it.id} className="relative">
            <span className={`absolute -left-[1.85rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg sm:-left-[2.35rem] ${it.status === 'passed' ? 'bg-ok' : it.status === 'failed' ? 'bg-danger' : 'bg-muted'}`} aria-hidden />
            <p className="meta mb-2">{format(new Date(it.closedAt), 'MMM d, yyyy')} · {pct(it.turnout)} turnout</p>
            {it.kind === 'election'
              ? <ElectionCard e={it} space={name} eligibleToVote={null} signedIn={false} onChange={reload} />
              : <CommunityVoteCard v={it} space={name} eligibleToVote={null} signedIn={false} onChange={reload} />}
          </li>
        ))}
      </ol>

      {data && data.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3"><Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button><span className="font-mono text-xs text-muted">{page} / {data.pagination.totalPages}</span><Button size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Older</Button></div>
      ) : null}
    </div>
  );
}
