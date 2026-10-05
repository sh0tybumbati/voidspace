'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Gavel, Info, Scale, Shield, UserPlus, Vote } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync } from '@/lib/hooks';
import type { GovernanceData } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorNotice, Skeleton } from '@/components/ui/Misc';
import { CommunityVoteCard, ElectionCard } from '@/components/governance/Cards';
import { StartElectionModal, StartVoteModal } from '@/components/governance/Modals';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function GovernancePage() {
  const { name } = useParams<{ name: string }>();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.get<GovernanceData>(`/api/spaces/${name}/governance`), [name, user?.id]);
  const [stand, setStand] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  const [propose, setPropose] = useState(false);

  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (error || !data) return <ErrorNotice message={error ?? 'Could not load governance.'} onRetry={reload} />;

  const { rules: R, eligibility: el } = data;
  const open = data.elections.filter((e) => e.status === 'active');
  const closedElections = data.elections.filter((e) => e.status !== 'active');
  const openVotes = data.votes.filter((v) => v.status === 'active');
  const closedVotes = data.votes.filter((v) => v.status !== 'active');
  const appeals = data.moderation.appeals;
  const decided = (appeals.approved ?? 0) + (appeals.denied ?? 0);
  const myMod = user ? data.moderators.some((m) => m.username === user.username) : false;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="meta"><Link href={`/v/${name}`} className="hover:text-ink">v/{name}</Link> / governance</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">How v/{name} is run</h1>
        <p className="mt-2 max-w-2xl text-ink-2">Moderators here are elected by members and can be voted out. Big decisions go to a vote. Everything below is public.</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Members', data.space.subscriberCount], ['Moderators', data.moderators.length], ['Mod actions, 30 days', data.moderation.actionsLast30Days], ['Appeals decided', decided]].map(([k, v]) => (
            <div key={String(k)} className="rounded-lg border border-line bg-surface px-4 py-3"><dt className="meta">{k}</dt><dd className="mt-1 font-mono text-2xl font-semibold tabular">{v}</dd></div>
          ))}
        </dl>
        {decided ? <p className="mt-2 text-xs text-muted">Of {decided} decided appeals, {appeals.approved ?? 0} were approved (the moderation was reversed) and {appeals.denied ?? 0} denied. <Link href={`/v/${name}/modlog`} className="link">Read the mod log</Link>.</p> : null}
      </header>

      <section aria-labelledby="mods">
        <h2 id="mods" className="mb-3 flex items-center gap-2 text-lg font-semibold"><Shield size={18} className="text-accent-text" /> Moderators</h2>
        <Card className="divide-y divide-line">
          {data.moderators.map((m) => (
            <div key={m.username} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={m.username} size={34} />
              <div className="min-w-0 flex-1"><Link href={`/u/${m.username}`} className="font-semibold hover:underline">{m.username}</Link><p className="text-xs text-muted">Since {format(new Date(m.addedAt), 'MMM d, yyyy')}</p></div>
              {m.isFounder ? <Badge tone="accent">Founder · removal needs {pct(R.election.founderRemovalApproval)}</Badge> : <Badge>Elected</Badge>}
              {user && user.username !== m.username && data.moderators.length > 1 ? <Button size="sm" variant="ghost" onClick={() => setRemove(m.username)}>Propose removal</Button> : null}
            </div>
          ))}
        </Card>
      </section>

      <section aria-labelledby="open">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="open" className="flex items-center gap-2 text-lg font-semibold"><Vote size={18} className="text-accent-text" /> Open decisions</h2>
          {user ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setStand(true)}><UserPlus size={14} /> Stand or nominate</Button>
              <Button size="sm" variant="secondary" onClick={() => setPropose(true)}><Gavel size={14} /> Propose a vote</Button>
            </div>
          ) : <Link href={`/login?redirect=/v/${name}/governance`} className="link text-sm font-semibold">Sign in to take part</Link>}
        </div>
        {user && el && !el.stand.ok ? <p className="mb-3 rounded border border-line bg-surface px-3 py-2 text-xs text-muted">You cannot stand for moderator yet: {el.stand.reasons.join(' ')}</p> : null}
        {!open.length && !openVotes.length ? <EmptyState icon={<Vote size={26} />} title="Nothing is being decided right now">When a member stands for moderator or proposes a change, it appears here for everyone to see.</EmptyState> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {open.map((e) => <ElectionCard key={e.id} e={e} space={name} eligibleToVote={el?.vote ?? null} signedIn={Boolean(user)} onChange={reload} />)}
          {openVotes.map((v) => <CommunityVoteCard key={v.id} v={v} space={name} eligibleToVote={el?.vote ?? null} signedIn={Boolean(user)} onChange={reload} />)}
        </div>
      </section>

      {closedElections.length || closedVotes.length ? (
        <section aria-labelledby="past">
          <h2 id="past" className="mb-3 text-lg font-semibold">Past decisions</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {closedElections.map((e) => <ElectionCard key={e.id} e={e} space={name} eligibleToVote={null} signedIn={Boolean(user)} onChange={reload} />)}
            {closedVotes.map((v) => <CommunityVoteCard key={v.id} v={v} space={name} eligibleToVote={null} signedIn={Boolean(user)} onChange={reload} />)}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="rules">
        <h2 id="rules" className="mb-3 flex items-center gap-2 text-lg font-semibold"><Scale size={18} className="text-accent-text" /> The rules of governance</h2>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Info size={14} /> Same for every space</span>} />
          <div className="grid gap-6 p-4 text-sm text-ink-2 md:grid-cols-3">
            <div><h3 className="mb-1.5 font-semibold text-ink">Becoming a moderator</h3><ul className="list-disc space-y-1 pl-4"><li>An account at least {R.candidate.accountAgeDays} days old</li><li>{R.candidate.minSpaceAlignment}+ alignment in this space</li><li>No active ban</li><li>{R.election.nominationDays} days of nomination, then {R.election.votingDays} days of voting</li><li>{pct(R.election.approval)} yes and {pct(R.election.turnout)} turnout to pass</li></ul></div>
            <div><h3 className="mb-1.5 font-semibold text-ink">Removing a moderator</h3><ul className="list-disc space-y-1 pl-4"><li>Anyone eligible can propose it, with a public reason</li><li>Same process and thresholds</li><li>A founder needs {pct(R.election.founderRemovalApproval)} to be removed</li><li>A space always keeps at least one moderator</li></ul></div>
            <div><h3 className="mb-1.5 font-semibold text-ink">Community votes</h3><ul className="list-disc space-y-1 pl-4"><li>Ads, rules, privacy, deleting the space</li><li>Proposer: member for {R.community.proposerAccountAgeDays}+ days</li><li>{R.community.discussionDays} days of discussion, {R.community.votingDays} days of voting</li><li>{pct(R.community.approval)} yes and {pct(R.community.turnout)} turnout</li><li>Moderators cannot veto</li></ul></div>
          </div>
          <p className="border-t border-line px-4 py-3 text-xs text-muted">Members can vote if they have joined the space and their account is {R.voter.accountAgeDays}+ days old. Ballots can be changed until voting closes, and running totals are hidden so they do not sway anyone.</p>
        </Card>
      </section>

      <StartElectionModal key={`stand-${stand}`} open={stand} onClose={() => setStand(false)} space={name} mode="add_mod" onDone={reload} />
      <StartElectionModal key={`remove-${remove}`} open={Boolean(remove)} onClose={() => setRemove(null)} space={name} mode="remove_mod" preset={remove ?? undefined} onDone={reload} />
      <StartVoteModal open={propose} onClose={() => setPropose(false)} space={name} currentRules={[]} onDone={reload} />
      {myMod ? <p className="text-center text-xs text-muted">You are a moderator here. <Link href={`/v/${name}/mod`} className="link">Open the mod queue</Link></p> : null}
    </div>
  );
}
