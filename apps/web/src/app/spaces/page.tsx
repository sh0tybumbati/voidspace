'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Compass, Lock, Plus, Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync, useDebounced } from '@/lib/hooks';
import type { Pagination, SpaceSummary } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorNotice, Skeleton } from '@/components/ui/Misc';

export default function SpacesPage() {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('subscribers');
  const [page, setPage] = useState(1);
  const search = useDebounced(q.trim());
  const { data, error, loading, reload } = useAsync(() => api.getSpaces({ page, limit: 24, search: search || undefined, sortBy }) as Promise<{ spaces: SpaceSummary[]; pagination: Pagination }>, [search, sortBy, page]);

  return (
    <div className="max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Compass size={22} className="text-accent-text" /> Explore spaces</h1><p className="mt-1 text-sm text-ink-2">Every space is run by moderators its members can vote in or out.</p></div>
        <ButtonLink href="/spaces/create" variant="primary"><Plus size={15} /> Create a space</ButtonLink>
      </header>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[14rem] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input aria-label="Search spaces" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search spaces" className="pl-9" /></div>
        <Select aria-label="Sort" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="w-44"><option value="subscribers">Most members</option><option value="new">Newest</option><option value="name">Name</option></Select>
      </div>
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}</div> : null}
      {data && !data.spaces.length ? <EmptyState title="No spaces found" action={<ButtonLink href="/spaces/create" variant="primary">Start one</ButtonLink>}>{search ? 'Nothing matches that. Try fewer words, or start the space yourself.' : 'Nobody has made a space yet. The first founder gets the whole place to themselves.'}</EmptyState> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.spaces.map((s) => (
          <Link key={s.id} href={`/v/${s.name}`} className="flex gap-3 rounded-lg border border-line bg-surface p-4 transition hover:border-line-strong">
            <Avatar name={s.name} src={s.iconUrl} size={40} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-semibold">v/{s.name}{s.isPrivate ? <Lock size={12} className="text-muted" /> : null}{s.isNsfw ? <Badge tone="danger">18+</Badge> : null}</p>
              <p className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-2">{s.description || s.displayName}</p>
              <p className="mt-1.5 flex items-center gap-1 font-mono text-xs text-muted"><Users size={11} /> {s.subscriberCount}</p>
            </div>
          </Link>
        ))}
      </div>
      {data && data.pagination.totalPages > 1 ? <div className="flex items-center justify-center gap-3"><Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><span className="font-mono text-xs text-muted">{page} / {data.pagination.totalPages}</span><Button size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div> : null}
    </div>
  );
}
