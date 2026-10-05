'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark, ChevronDown, ChevronRight, Flag, Link2, MessageSquare, Pencil, ShieldAlert, ShieldX, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import type { Comment } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import MarkdownEditor from '@/components/ui/MarkdownEditor';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { TimeAgo } from '@/components/ui/Misc';
import { toast } from '@/components/ui/Toast';
import { RemoveModal } from '@/components/moderation/RemoveModal';
import { ReportModal } from '@/components/moderation/ReportModal';
import VoteButtons from '@/components/posts/VoteButtons';
import { UserLink, isDeletedName } from '@/components/ui/UserLink';

export interface CommentNode extends Comment { children: CommentNode[] }
export interface ThreadContext { postId: string; spaceName: string; postAuthor: string; isModerator: boolean; canComment: boolean; reload: () => void }

const MAX_INDENT = 6;

export function CommentComposer({ ctx, parentId, initial = '', editId, onDone, autoFocus }: { ctx: ThreadContext; parentId?: string; initial?: string; editId?: string; onDone: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      if (editId) await api.updateComment(editId, { content: text.trim() });
      else await api.createComment({ postId: ctx.postId, parentCommentId: parentId, content: text.trim() });
      setText('');
      onDone();
      ctx.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not post your comment.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2" data-autofocus={autoFocus ? '' : undefined}>
      <MarkdownEditor value={text} onChange={setText} rows={parentId || editId ? 4 : 5} maxLength={10000} placeholder={parentId ? 'Write a reply...' : 'What do you think?'} />
      <div className="flex justify-end gap-2">
        {parentId || editId ? <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button> : null}
        <Button size="sm" variant="primary" disabled={!text.trim()} loading={busy} onClick={submit}>{editId ? 'Save' : parentId ? 'Reply' : 'Comment'}</Button>
      </div>
    </div>
  );
}

export default function CommentItem({ node, ctx, depth = 0 }: { node: CommentNode; ctx: ThreadContext; depth?: number }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(Boolean(node.isSaved));
  const [reporting, setReporting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const mine = user?.username === node.author.username;
  const anchor = `comment-${node.id}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === `#${anchor}`) {
      setHighlight(true);
      document.getElementById(anchor)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const t = setTimeout(() => setHighlight(false), 2500);
      return () => clearTimeout(t);
    }
  }, [anchor]);

  const toggleSave = async () => {
    if (!user) { toast.info('Sign in to save comments.', '/login'); return; }
    const next = !saved; setSaved(next);
    try { await (next ? api.saveComment(node.id) : api.unsaveComment(node.id)); } catch (e) { setSaved(!next); toast.error(e instanceof Error ? e.message : 'Could not save.'); }
  };
  const del = async () => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    try { await api.deleteComment(node.id); ctx.reload(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete.'); }
  };
  const link = async () => { try { await navigator.clipboard.writeText(`${location.origin}/v/${ctx.spaceName}/${ctx.postId}#${anchor}`); toast.success('Link copied.'); } catch { toast.error('Could not copy the link.'); } };

  const act = 'flex h-6 items-center gap-1.5 rounded px-1.5 text-[0.76rem] font-medium text-muted transition hover:bg-surface-3 hover:text-ink';

  return (
    <div id={anchor} className={cn('relative', highlight && 'rounded bg-accent/10 ring-1 ring-accent/50')}>
      <div className="flex gap-2.5">
        <div className="flex flex-col items-center">
          <Avatar name={isDeletedName(node.author.username) ? '?' : node.author.username} src={node.author.avatarUrl} size={26} className="mt-0.5" />
          {!collapsed && node.children.length ? <button onClick={() => setCollapsed(true)} aria-label="Collapse thread" className="group mt-1 w-4 flex-1 cursor-pointer"><span className="mx-auto block h-full w-px bg-line transition group-hover:bg-accent" /></button> : null}
        </div>
        <div className="min-w-0 flex-1 pb-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.78rem]">
            <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand' : 'Collapse'} className="text-muted hover:text-ink">{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
            <UserLink name={node.author.username} className="font-semibold text-ink hover:underline" />
            {node.author.username === ctx.postAuthor ? <Badge tone="info">OP</Badge> : null}
            <TimeAgo date={node.createdAt} className="text-muted" />
            {node.editedAt ? <span className="text-muted">edited</span> : null}
            {collapsed ? <span className="text-muted">({node.children.length + 1} hidden)</span> : null}
          </div>

          {!collapsed ? (
            <>
              {node.removed ? (
                <div className="mt-1 flex items-start gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  <div><p className="font-semibold">Removed by a moderator</p>{node.removalReason ? <p className="text-xs opacity-90">{node.removalReason}</p> : null}</div>
                </div>
              ) : editing ? (
                <div className="mt-1.5"><CommentComposer ctx={ctx} editId={node.id} initial={node.content} onDone={() => setEditing(false)} /></div>
              ) : (
                <>
                  <MarkdownRenderer content={node.content} className="mt-1" />
                  {node.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={api.assetUrl(node.imageUrl)} alt="" loading="lazy" className="mt-2 max-h-72 rounded-md border border-line" />
                  ) : null}
                  <div className="-ml-1.5 mt-1 flex flex-wrap items-center gap-0.5">
                    <VoteButtons kind="comment" id={node.id} score={node.voteScore} userVote={node.userVote} layout="inline" />
                    {ctx.canComment && depth < 12 ? <button onClick={() => (user ? setReplying((r) => !r) : toast.info('Sign in to reply.', '/login'))} className={act}><MessageSquare size={13} /> Reply</button> : null}
                    <button onClick={link} className={act}><Link2 size={13} /> Link</button>
                    <button onClick={toggleSave} className={cn(act, saved && 'text-accent-text')} aria-pressed={saved}><Bookmark size={13} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}</button>
                    {mine ? <button onClick={() => setEditing(true)} className={act}><Pencil size={13} /> Edit</button> : null}
                    {mine ? <button onClick={del} className={cn(act, 'hover:text-danger')}><Trash2 size={13} /> Delete</button> : null}
                    {user && !mine ? <button onClick={() => setReporting(true)} className={cn(act, 'hover:text-danger')}><Flag size={13} /> Report</button> : null}
                    {ctx.isModerator && !mine ? <button onClick={() => setRemoving(true)} className={cn(act, 'text-warn hover:text-danger')}><ShieldX size={13} /> Remove</button> : null}
                  </div>
                </>
              )}
              {replying ? <div className="mt-2"><CommentComposer ctx={ctx} parentId={node.id} onDone={() => setReplying(false)} autoFocus /></div> : null}

              {node.children.length ? (
                <div className={cn('mt-2 space-y-1', depth + 1 < MAX_INDENT ? '' : '-ml-[34px]')}>
                  {node.children.map((c) => <CommentItem key={c.id} node={c} ctx={ctx} depth={depth + 1} />)}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <ReportModal open={reporting} onClose={() => setReporting(false)} targetType="comment" targetId={node.id} />
      <RemoveModal open={removing} onClose={() => setRemoving(false)} targetType="comment" targetId={node.id} onRemoved={ctx.reload} />
    </div>
  );
}
