'use client';

import { useState } from 'react';
import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { toast } from '@/components/ui/Toast';

type Kind = 'post' | 'comment';

/**
 * Up/down voting with the count between. Updates immediately and rolls back if the server refuses.
 * `layout="rail"` stacks vertically (post cards), `"inline"` goes in a row (comments).
 */
export default function VoteButtons({ kind, id, score, userVote, layout = 'rail' }: { kind: Kind; id: string; score: number; userVote?: number | null; layout?: 'rail' | 'inline' }) {
  const { user } = useAuth();
  const [state, setState] = useState({ score, vote: userVote ?? 0 });
  const [busy, setBusy] = useState(false);

  const cast = async (value: 1 | -1) => {
    if (!user) { toast.info('Sign in to vote.', '/login'); return; }
    if (busy) return;
    const previous = state;
    const next = state.vote === value ? 0 : value;
    setState({ vote: next, score: state.score - state.vote + next });
    setBusy(true);
    try {
      if (next === 0) await (kind === 'post' ? api.removePostVote(id) : api.removeCommentVote(id));
      else await (kind === 'post' ? api.voteOnPost(id, value) : api.voteOnComment(id, value));
    } catch (e) {
      setState(previous);
      toast.error(e instanceof Error ? e.message : 'Could not record your vote.');
    } finally {
      setBusy(false);
    }
  };

  const btn = (value: 1 | -1, Icon: typeof ArrowBigUp, label: string) => {
    const active = state.vote === value;
    return (
      <button onClick={() => cast(value)} aria-label={label} aria-pressed={active}
        className={cn('grid h-7 w-7 place-items-center rounded transition hover:bg-surface-3', active ? (value === 1 ? 'text-accent-text' : 'text-danger') : 'text-muted hover:text-ink')}>
        <Icon size={20} className={cn(active && 'animate-pop')} fill={active ? 'currentColor' : 'none'} />
      </button>
    );
  };

  return (
    <div className={cn('flex items-center', layout === 'rail' ? 'flex-col gap-0.5' : 'gap-1')}>
      {btn(1, ArrowBigUp, `Upvote ${kind}`)}
      <span className={cn('min-w-[1.5rem] text-center font-mono text-[0.8rem] font-semibold tabular', state.vote === 1 ? 'text-accent-text' : state.vote === -1 ? 'text-danger' : 'text-ink-2')}>{state.score}</span>
      {btn(-1, ArrowBigDown, `Downvote ${kind}`)}
    </div>
  );
}
