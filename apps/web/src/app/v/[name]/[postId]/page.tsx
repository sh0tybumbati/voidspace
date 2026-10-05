'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bookmark, ExternalLink, Eye, Flag, Gavel, Link2, Pencil, ShieldAlert, ShieldCheck, ShieldX, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import type { Post, Space } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import MarkdownEditor from '@/components/ui/MarkdownEditor';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';
import { toast } from '@/components/ui/Toast';
import CommentThread from '@/components/comments/CommentThread';
import SpaceSidebar from '@/components/layout/SpaceSidebar';
import { RemoveModal } from '@/components/moderation/RemoveModal';
import { ReportModal } from '@/components/moderation/ReportModal';
import { Flair } from '@/components/posts/PostCard';
import VoteButtons from '@/components/posts/VoteButtons';

interface AppealInfo { action: { id: string; reason: string; createdAt: string; space: string; reversed: boolean }; appeal: { id: string; status: string; reviewerNotes?: string | null } | null; canAppeal: boolean }

export default function PostPage() {
  const { name, postId } = useParams<{ name: string; postId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [meta, setMeta] = useState({ isSubscribed: false, isModerator: false });
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [removing, setRemoving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [appeal, setAppeal] = useState<AppealInfo | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api.getPost(postId), api.getSpace(name)]);
      setPost(p.post); setSaved(Boolean(p.post.isSaved)); setSpace(s.space); setMeta({ isSubscribed: s.isSubscribed, isModerator: s.isModerator }); setState('ok');
    } catch (e) {
      setState(/not found/i.test((e as Error).message) ? 'missing' : 'error');
    }
  }, [postId, name]);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, user, load]);

  useEffect(() => {
    if (post?.removed && user?.username === post.author.username) {
      api.get<AppealInfo>(`/api/appeals/target/post/${post.id}`).then(setAppeal).catch(() => setAppeal(null));
    }
  }, [post, user]);

  if (state === 'loading') return <div className="space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full" /></div>;
  if (state === 'missing' || !post || !space) return <EmptyState title="Post not found" action={<ButtonLink href={`/v/${name}`} variant="secondary">Back to v/{name}</ButtonLink>}>It may have been deleted, or it is in a private space.</EmptyState>;
  if (state === 'error') return <ErrorNotice message="Could not load this post." onRetry={load} />;

  const mine = user?.username === post.author.username;
  const blurred = (post.isNsfw || space.isNsfw) && !reveal;

  const save = async () => {
    if (!user) { toast.info('Sign in to save posts.', '/login'); return; }
    const next = !saved; setSaved(next);
    try { await (next ? api.savePost(post.id) : api.unsavePost(post.id)); } catch (e) { setSaved(!next); toast.error((e as Error).message); }
  };
  const del = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try { await api.deletePost(post.id); toast.success('Post deleted.'); router.push(`/v/${name}`); } catch (e) { toast.error((e as Error).message); }
  };
  const saveEdit = async () => {
    try { await api.updatePost(post.id, { title: draft.title.trim(), content: draft.content }); setEditing(false); await load(); } catch (e) { toast.error((e as Error).message); }
  };
  const restore = async () => {
    try { await api.post('/api/mod/restore-post', { postId: post.id }); toast.success('Post restored.'); await load(); } catch (e) { toast.error((e as Error).message); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(location.href); toast.success('Link copied.'); } catch { toast.error('Could not copy.'); } };

  const bar = 'flex h-8 items-center gap-1.5 rounded px-2.5 text-[0.82rem] font-medium text-muted transition hover:bg-surface-3 hover:text-ink';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <article className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <div className="flex gap-4">
            <div className="hidden sm:block"><VoteButtons kind="post" id={post.id} score={post.voteScore} userVote={post.userVote} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.8rem] text-muted">
                <Link href={`/v/${name}`} className="flex items-center gap-1.5 font-semibold text-ink hover:text-accent-text"><Avatar name={name} size={20} /> v/{name}</Link>
                <span>by <Link href={`/u/${post.author.username}`} className="hover:text-ink hover:underline">{post.author.username}</Link></span>
                <TimeAgo date={post.createdAt} />
                {post.editedAt ? <span>edited</span> : null}
                {post.isNsfw ? <Badge tone="danger">NSFW</Badge> : null}
                {post.flair ? <Flair flair={post.flair} /> : null}
              </div>

              {editing ? (
                <div className="mt-3 space-y-3">
                  <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={300} aria-label="Title" />
                  {post.postType === 'text' ? <MarkdownEditor value={draft.content} onChange={(v) => setDraft((d) => ({ ...d, content: v }))} rows={8} /> : null}
                  <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button variant="primary" onClick={saveEdit}>Save changes</Button></div>
                </div>
              ) : (
                <>
                  <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-[1.7rem]">{post.title}</h1>
                  {post.removed ? (
                    <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm">
                      <p className="flex items-center gap-2 font-semibold text-danger"><ShieldAlert size={16} /> Removed by a moderator</p>
                      {post.removalReason ? <p className="mt-1 text-ink-2">{post.removalReason}</p> : null}
                      <p className="mt-2 text-xs text-muted">Every removal is recorded in the <Link href={`/v/${name}/modlog`} className="link">public mod log</Link>.</p>
                      {appeal?.canAppeal ? <ButtonLink href={`/appeals/new?action=${appeal.action.id}`} variant="outline" size="sm" className="mt-3"><Gavel size={14} /> Appeal this decision</ButtonLink> : null}
                      {appeal?.appeal ? <p className="mt-3 text-xs text-ink-2">Your appeal is <b>{appeal.appeal.status}</b>. <Link href="/appeals" className="link">See my appeals</Link></p> : null}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {post.postType === 'image' && post.url ? (
                        <div className="relative overflow-hidden rounded-md border border-line bg-surface-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={api.assetUrl(post.url)} alt="" className={cn('mx-auto max-h-[36rem] w-full object-contain transition', blurred && 'scale-110 blur-3xl')} />
                          {blurred ? <button onClick={() => setReveal(true)} className="absolute inset-0 grid place-items-center bg-bg/40 text-sm font-semibold"><span className="flex items-center gap-2 rounded bg-surface px-3 py-2"><Eye size={16} /> Show adult content</span></button> : null}
                        </div>
                      ) : null}
                      {post.postType === 'link' && post.url ? (
                        <a href={post.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-sm text-info hover:border-line-strong"><ExternalLink size={15} /> <span className="truncate">{post.url}</span></a>
                      ) : null}
                      {post.content ? <div className={cn(blurred && 'select-none blur-md')}><MarkdownRenderer content={post.content} /></div> : null}
                    </div>
                  )}
                </>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                <div className="sm:hidden"><VoteButtons kind="post" id={post.id} score={post.voteScore} userVote={post.userVote} layout="inline" /></div>
                <button onClick={save} aria-pressed={saved} className={cn(bar, saved && 'text-accent-text')}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}</button>
                <button onClick={copy} className={bar}><Link2 size={15} /> Share</button>
                {mine && !post.removed ? <button onClick={() => { setDraft({ title: post.title, content: post.content ?? '' }); setEditing(true); }} className={bar}><Pencil size={15} /> Edit</button> : null}
                {mine ? <button onClick={del} className={cn(bar, 'hover:text-danger')}><Trash2 size={15} /> Delete</button> : null}
                {user && !mine ? <button onClick={() => setReporting(true)} className={cn(bar, 'hover:text-danger')}><Flag size={15} /> Report</button> : null}
                {meta.isModerator && !mine && !post.removed ? <button onClick={() => setRemoving(true)} className={cn(bar, 'text-warn hover:text-danger')}><ShieldX size={15} /> Remove</button> : null}
                {meta.isModerator && post.removed ? <button onClick={restore} className={cn(bar, 'text-ok')}><ShieldCheck size={15} /> Restore</button> : null}
              </div>
            </div>
          </div>
        </article>

        <CommentThread postId={post.id} spaceName={name} postAuthor={post.author.username} isModerator={meta.isModerator} locked={post.removed} />
      </div>

      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <SpaceSidebar space={space} isSubscribed={meta.isSubscribed} isModerator={meta.isModerator} onChanged={(joined) => setMeta((m) => ({ ...m, isSubscribed: joined }))} />
      </aside>
      <ReportModal open={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post.id} />
      <RemoveModal open={removing} onClose={() => setRemoving(false)} targetType="post" targetId={post.id} onRemoved={load} />
    </div>
  );
}
