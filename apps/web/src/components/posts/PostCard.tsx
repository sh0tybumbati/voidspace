'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark, Eye, EyeOff, ExternalLink, Flag, Link2, MessageSquare, Pin, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import type { Post } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { TimeAgo } from '@/components/ui/Misc';
import { toast } from '@/components/ui/Toast';
import { ReportModal } from '@/components/moderation/ReportModal';
import VoteButtons from './VoteButtons';

const stripMarkdown = (s: string) => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~-]+/g, ' ').replace(/\s+/g, ' ').trim();
const domainOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

export function Flair({ flair }: { flair: NonNullable<Post['flair']> }) {
  return <span className="rounded px-1.5 py-0.5 text-[0.68rem] font-semibold" style={{ color: flair.textColor, backgroundColor: flair.bgColor }}>{flair.text}</span>;
}

export default function PostCard({ post, showSpace = true }: { post: Post; showSpace?: boolean }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(Boolean(post.isSaved));
  const [reveal, setReveal] = useState(false);
  const [reporting, setReporting] = useState(false);
  const href = `/v/${post.space.name}/${post.id}`;
  const blurred = (post.isNsfw || post.space.isNsfw) && !reveal;
  const preview = post.content ? stripMarkdown(post.content).slice(0, 260) : '';

  const toggleSave = async () => {
    if (!user) { toast.info('Sign in to save posts.', '/login'); return; }
    const next = !saved;
    setSaved(next);
    try { await (next ? api.savePost(post.id) : api.unsavePost(post.id)); }
    catch (e) { setSaved(!next); toast.error(e instanceof Error ? e.message : 'Could not save.'); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}${href}`); toast.success('Link copied.'); } catch { toast.error('Could not copy the link.'); }
  };

  return (
    <article className="group flex gap-3 rounded-lg border border-line bg-surface p-3 transition hover:border-line-strong sm:gap-4 sm:p-4">
      <VoteButtons kind="post" id={post.id} score={post.voteScore} userVote={post.userVote} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-muted">
          {showSpace ? (
            <Link href={`/v/${post.space.name}`} className="flex items-center gap-1.5 font-semibold text-ink hover:text-accent-text"><Avatar name={post.space.name} src={post.space.iconUrl} size={18} />v/{post.space.name}</Link>
          ) : null}
          <span>by <Link href={`/u/${post.author.username}`} className="hover:text-ink hover:underline">{post.author.username}</Link></span>
          <TimeAgo date={post.createdAt} />
          {post.isEdited || post.editedAt ? <span>edited</span> : null}
          {post.isPinned ? <Badge tone="ok"><Pin size={10} /> Pinned</Badge> : null}
          {post.isNsfw ? <Badge tone="danger">NSFW</Badge> : null}
          {post.flair ? <Flair flair={post.flair} /> : null}
        </div>

        {post.removed ? (
          <div className="mt-2 flex items-start gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <div><p className="font-semibold">Removed by a moderator</p>{post.removalReason ? <p className="text-xs opacity-90">{post.removalReason}</p> : null}</div>
          </div>
        ) : (
          <>
            <h2 className="mt-1.5 text-[1.05rem] font-semibold leading-snug tracking-tight sm:text-lg"><Link href={href} className="hover:text-accent-text">{post.title}</Link></h2>
            {post.postType === 'image' && post.url ? (
              <Link href={href} className="relative mt-2.5 block overflow-hidden rounded-md border border-line bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.assetUrl(post.url)} alt="" loading="lazy" className={cn('max-h-[28rem] w-full object-contain transition', blurred && 'scale-110 blur-2xl')} />
                {blurred ? (
                  <button onClick={(e) => { e.preventDefault(); setReveal(true); }} className="absolute inset-0 grid place-items-center bg-bg/40 text-sm font-semibold"><span className="flex items-center gap-2 rounded bg-surface px-3 py-2"><Eye size={16} /> Show adult content</span></button>
                ) : null}
              </Link>
            ) : null}
            {post.postType === 'link' && post.url ? (
              <a href={post.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-2 inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2.5 py-1 font-mono text-xs text-info hover:border-line-strong"><ExternalLink size={12} /> {domainOf(post.url)}</a>
            ) : null}
            {preview && post.postType === 'text' ? <p className={cn('mt-1.5 line-clamp-3 text-sm text-ink-2', blurred && 'blur-sm select-none')}>{preview}</p> : null}
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1 text-[0.8rem] font-medium text-muted">
          <Link href={`${href}#comments`} className="flex h-7 items-center gap-1.5 rounded px-2 hover:bg-surface-3 hover:text-ink"><MessageSquare size={15} /> {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</Link>
          <button onClick={toggleSave} aria-pressed={saved} className={cn('flex h-7 items-center gap-1.5 rounded px-2 hover:bg-surface-3 hover:text-ink', saved && 'text-accent-text')}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}</button>
          <button onClick={share} className="flex h-7 items-center gap-1.5 rounded px-2 hover:bg-surface-3 hover:text-ink"><Link2 size={15} /> Share</button>
          {user && user.username !== post.author.username ? (
            <button onClick={() => setReporting(true)} className="flex h-7 items-center gap-1.5 rounded px-2 opacity-0 transition hover:bg-surface-3 hover:text-danger focus:opacity-100 group-hover:opacity-100"><Flag size={14} /> Report</button>
          ) : null}
          {post.isNsfw && reveal ? <button onClick={() => setReveal(false)} className="flex h-7 items-center gap-1.5 rounded px-2 hover:bg-surface-3"><EyeOff size={14} /> Hide</button> : null}
        </div>
      </div>
      <ReportModal open={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post.id} />
    </article>
  );
}
