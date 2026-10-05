'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Vote as VoteIcon, XCircle } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { CommunityVoteView, ElectionView, Eligibility } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

/** Counts from 0 to `to` once on mount; jumps straight to the number when motion is reduced. */
function useCountUp(to: number, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return n;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const when = (iso: string) => format(new Date(iso), 'MMM d, h:mm a');
const left = (iso: string) => formatDistanceToNowStrict(new Date(iso));

const VOTE_LABELS: Record<string, string> = {
  enable_ads: 'Enable ads', disable_ads: 'Disable ads', change_rules: 'Change the rules',
  set_private: 'Make the space private', set_public: 'Make the space public', delete_space: 'Delete the space',
};

/** Three steps with the current one lit: nomination or discussion, voting, result. */
function Timeline({ phase, first, startsAt, endsAt }: { phase: string; first: string; startsAt: string; endsAt: string }) {
  const steps = [{ id: 'early', label: first, sub: `until ${when(startsAt)}` }, { id: 'voting', label: 'Voting', sub: `until ${when(endsAt)}` }, { id: 'closed', label: 'Result', sub: '' }];
  const current = phase === 'voting' ? 1 : phase === 'closed' ? 2 : 0;
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.id} aria-current={i === current ? 'step' : undefined}>
          <div className="h-1 overflow-hidden rounded-full bg-line"><div style={{ animationDelay: `${i * 120}ms` }} className={cn('h-full origin-left animate-grow rounded-full', i < current ? 'bg-accent/60' : i === current ? 'bg-accent' : 'bg-transparent')} /></div>
          <p className={cn('mt-1.5 flex items-center gap-1.5 text-xs font-semibold', i === current ? 'text-ink' : 'text-muted')}>{i === current && phase !== 'closed' ? <span className="h-1.5 w-1.5 animate-blink rounded-full bg-accent" aria-hidden /> : null}{s.label}</p>
          {s.sub ? <p className="font-mono text-[0.65rem] text-muted">{s.sub}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function Threshold({ approval, turnout, subscribers }: { approval: number; turnout: number; subscribers: number }) {
  return <p className="text-xs text-muted">Passes with <b className="text-ink-2">{pct(approval)}</b> yes votes and <b className="text-ink-2">{pct(turnout)}</b> turnout ({Math.ceil(subscribers * turnout)} of {subscribers} members when it began).</p>;
}

function Result({ f, a, status, approval, turnout, subscribers }: { f: number; a: number; status: string; approval: number; turnout: number; subscribers: number }) {
  const total = f + a;
  const got = total ? f / total : 0;
  const passed = status === 'passed';
  const yes = useCountUp(f);
  const no = useCountUp(a);
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), 120); return () => clearTimeout(t); }, []);
  return (
    <div className="animate-reveal rounded-md border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between text-sm"><span className={cn('flex items-center gap-1.5 font-semibold', passed ? 'text-ok' : 'text-danger')}>{passed ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {passed ? 'Passed' : 'Did not pass'}</span><span className="font-mono text-xs text-muted tabular">{yes} yes · {no} no</span></div>
      <div className="relative mt-3 h-2 rounded-full bg-line" role="img" aria-label={`${pct(got)} yes, ${pct(approval)} needed`}>
        <div className={cn('h-full rounded-full transition-[width] duration-[900ms] ease-out', passed ? 'bg-ok' : 'bg-danger')} style={{ width: filled ? `${got * 100}%` : '0%' }} />
        <div className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `${approval * 100}%` }} title={`Needed: ${pct(approval)}`} />
      </div>
      <p className="mt-2 text-xs text-muted">{pct(got)} yes (needed {pct(approval)}, marked above) · {pct(total / Math.max(1, subscribers))} turnout (needed {pct(turnout)})</p>
    </div>
  );
}

function BallotButtons({ endpoint, mine, onDone, eligible }: { endpoint: string; mine: 'for' | 'against' | null; onDone: () => void; eligible: Eligibility | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const cast = async (vote: 'for' | 'against') => {
    setBusy(vote);
    try { await api.post(endpoint, { vote }); toast.success('Your vote was recorded. You can change it until voting closes.'); onDone(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not record your vote.'); }
    finally { setBusy(null); }
  };
  if (eligible && !eligible.ok) return <p className="rounded border border-line bg-surface-2 px-3 py-2 text-xs text-muted">You cannot vote: {eligible.reasons.join(' ')}</p>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Button key={`f${mine}`} className={mine === 'for' ? 'animate-reveal' : ''} variant={mine === 'for' ? 'primary' : 'secondary'} loading={busy === 'for'} onClick={() => cast('for')}>Yes{mine === 'for' ? ' (your vote)' : ''}</Button>
        <Button key={`a${mine}`} className={mine === 'against' ? 'animate-reveal' : ''} variant={mine === 'against' ? 'danger' : 'secondary'} loading={busy === 'against'} onClick={() => cast('against')}>No{mine === 'against' ? ' (your vote)' : ''}</Button>
      </div>
      <p className="mt-2 text-xs text-muted">Results stay hidden until voting closes so nobody is swayed by the running count.</p>
    </div>
  );
}

export function ElectionCard({ e, space, eligibleToVote, signedIn, onChange }: { e: ElectionView; space: string; eligibleToVote: Eligibility | null; signedIn: boolean; onChange: () => void }) {
  const isAdd = e.type === 'add_mod';
  const nominationOpen = e.phase === 'nomination';
  const [busy, setBusy] = useState<string | null>(null);
  const respond = async (accept: boolean) => {
    setBusy(accept ? 'a' : 'd');
    try { await api.post(`/api/elections/${e.id}/${accept ? 'accept' : 'decline'}`); onChange(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not respond.'); }
    finally { setBusy(null); }
  };
  return (
    <article className="space-y-4 rounded-lg border border-line bg-surface p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="meta">{isAdd ? 'Moderator election' : 'Vote to remove a moderator'}</p>
          <h3 className="mt-0.5 text-lg font-semibold">{isAdd ? <>Should <Link href={`/u/${e.candidate}`} className="link">{e.candidate}</Link> be a moderator?</> : <>Remove <Link href={`/u/${e.candidate}`} className="link">{e.candidate}</Link> as moderator?</>}</h3>
          {e.nominator && e.nominator !== e.candidate ? <p className="text-xs text-muted">{isAdd ? 'Nominated' : 'Proposed'} by {e.nominator}</p> : isAdd ? <p className="text-xs text-muted">Standing for election</p> : null}
        </div>
        <Badge tone={e.status === 'active' ? (e.phase === 'voting' ? 'accent' : 'info') : e.status === 'passed' ? 'ok' : 'neutral'}>{e.status === 'active' ? (e.phase === 'voting' ? 'Voting open' : 'Nomination period') : e.status}</Badge>
      </header>
      {e.justification ? <blockquote className="border-l-2 border-line-strong pl-3 text-sm text-ink-2">{e.justification}</blockquote> : null}
      {e.status === 'active' ? (
        <>
          <Timeline phase={e.phase} first="Nomination" startsAt={e.votingStartsAt} endsAt={e.votingEndsAt} />
          <Threshold approval={e.requiredApproval} turnout={e.requiredTurnout} subscribers={e.subscribersAtStart} />
          {nominationOpen && isAdd && !e.accepted && e.isCandidate ? (
            <div className="flex flex-wrap items-center gap-2 rounded border border-accent/40 bg-accent/5 p-3"><p className="flex-1 text-sm">You were nominated. Accept before voting opens ({left(e.votingStartsAt)} left), or it lapses.</p><Button variant="primary" size="sm" loading={busy === 'a'} onClick={() => respond(true)}>Accept</Button><Button size="sm" loading={busy === 'd'} onClick={() => respond(false)}>Decline</Button></div>
          ) : null}
          {nominationOpen && isAdd && !e.accepted && !e.isCandidate ? <p className="text-xs text-warn">Waiting for {e.candidate} to accept the nomination.</p> : null}
          {e.phase === 'voting' && !e.isCandidate && (signedIn ? <BallotButtons endpoint={`/api/elections/${e.id}/vote`} mine={e.myVote} onDone={onChange} eligible={eligibleToVote} /> : <p className="text-sm text-muted"><Link href={`/login?redirect=/v/${space}/governance`} className="link">Sign in</Link> to vote.</p>)}
          {e.phase === 'voting' && e.isCandidate ? <p className="text-xs text-muted">You cannot vote in your own election.</p> : null}
          <p className="flex items-center gap-1.5 text-xs text-muted"><Clock size={12} /> {e.ballotsCast} {e.ballotsCast === 1 ? 'vote' : 'votes'} so far · {nominationOpen ? `voting opens in ${left(e.votingStartsAt)}` : `closes in ${left(e.votingEndsAt)}`}</p>
        </>
      ) : e.status === 'withdrawn' ? <p className="text-sm text-muted">The nomination was withdrawn or never accepted.</p>
        : <Result f={e.votesFor ?? 0} a={e.votesAgainst ?? 0} status={e.status} approval={e.requiredApproval} turnout={e.requiredTurnout} subscribers={e.subscribersAtStart} />}
    </article>
  );
}

export function CommunityVoteCard({ v, space, eligibleToVote, signedIn, onChange }: { v: CommunityVoteView; space: string; eligibleToVote: Eligibility | null; signedIn: boolean; onChange: () => void }) {
  return (
    <article className="space-y-4 rounded-lg border border-line bg-surface p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="meta">Community vote · {VOTE_LABELS[v.type] ?? v.type}</p><h3 className="mt-0.5 text-lg font-semibold">{v.title}</h3>{v.proposer ? <p className="text-xs text-muted">Proposed by {v.proposer}</p> : null}</div>
        <Badge tone={v.status === 'active' ? (v.phase === 'voting' ? 'accent' : 'info') : v.status === 'passed' ? 'ok' : 'neutral'}>{v.status === 'active' ? (v.phase === 'voting' ? 'Voting open' : 'Discussion') : v.status}</Badge>
      </header>
      <p className="whitespace-pre-line text-sm text-ink-2">{v.proposal}</p>
      {v.payload?.rules?.length ? <ol className="list-decimal space-y-1 rounded border border-line bg-surface-2 py-2 pl-8 pr-3 text-sm text-ink-2">{v.payload.rules.map((r, i) => <li key={i}>{r}</li>)}</ol> : null}
      {v.status === 'active' ? (
        <>
          <Timeline phase={v.phase} first="Discussion" startsAt={v.votingStartsAt} endsAt={v.votingEndsAt} />
          <Threshold approval={v.requiredApproval} turnout={v.requiredTurnout} subscribers={v.subscribersAtStart} />
          {v.phase === 'voting' ? (signedIn ? <BallotButtons endpoint={`/api/votes/${v.id}/ballot`} mine={v.myVote} onDone={onChange} eligible={eligibleToVote} /> : <p className="text-sm text-muted"><Link href={`/login?redirect=/v/${space}/governance`} className="link">Sign in</Link> to vote.</p>) : <p className="text-xs text-muted">Voting opens in {left(v.votingStartsAt)}. Talk it over with the community until then.</p>}
          <p className="flex items-center gap-1.5 text-xs text-muted"><Clock size={12} /> {v.ballotsCast} {v.ballotsCast === 1 ? 'vote' : 'votes'} so far</p>
        </>
      ) : <Result f={v.votesFor ?? 0} a={v.votesAgainst ?? 0} status={v.status} approval={v.requiredApproval} turnout={v.requiredTurnout} subscribers={v.subscribersAtStart} />}
    </article>
  );
}

export { VOTE_LABELS, VoteIcon };
