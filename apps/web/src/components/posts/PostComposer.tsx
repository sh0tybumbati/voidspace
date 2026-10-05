'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ImagePlus, Link2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import type { Flair } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import MarkdownEditor from '@/components/ui/MarkdownEditor';
import { toast } from '@/components/ui/Toast';

type Kind = 'text' | 'link' | 'image';
interface MySpace { name: string; displayName: string }

const KINDS: { id: Kind; label: string; icon: typeof FileText }[] = [
  { id: 'text', label: 'Text', icon: FileText },
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'image', label: 'Image', icon: ImagePlus },
];

export default function PostComposer({ spaceName }: { spaceName?: string }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [spaces, setSpaces] = useState<MySpace[]>([]);
  const [chosen, setChosen] = useState(spaceName ?? '');
  const [space, setSpace] = useState<{ id: string; rules?: string[] | null; isNsfw: boolean } | null>(null);
  const [flairs, setFlairs] = useState<Flair[]>([]);
  const [kind, setKind] = useState<Kind>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState<{ url: string; preview: string } | null>(null);
  const [flairId, setFlairId] = useState('');
  const [nsfw, setNsfw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || spaceName) return;
    api.get<{ spaces: MySpace[] }>('/api/spaces/mine').then((r) => setSpaces(r.spaces)).catch(() => undefined);
  }, [user, spaceName]);

  useEffect(() => {
    if (!chosen) { setSpace(null); setFlairs([]); return; }
    api.getSpace(chosen).then((d: { space: { id: string; rules?: string[] | null; isNsfw: boolean } }) => { setSpace(d.space); setNsfw(d.space.isNsfw); }).catch(() => setSpace(null));
    api.getSpaceFlairs(chosen).then((d: { flairs: Flair[] }) => setFlairs(d.flairs ?? [])).catch(() => setFlairs([]));
  }, [chosen]);

  if (isLoading) return null;
  if (!user) return <Card className="p-6 text-center"><p className="mb-3 text-ink-2">Sign in to post.</p><Link href="/login" className="link font-semibold">Sign in</Link></Card>;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true); setError(null);
    try {
      const up = await api.uploadImage(f);
      setImage({ url: up.url, preview: URL.createObjectURL(f) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const valid = Boolean(space) && title.trim().length > 0 && (kind === 'text' || (kind === 'link' && /^https?:\/\//i.test(url)) || (kind === 'image' && image));

  const submit = async () => {
    if (!space) return;
    setBusy(true); setError(null);
    try {
      const res = await api.createPost({
        spaceId: space.id, title: title.trim(), postType: kind, isNsfw: nsfw, flairId: flairId || undefined,
        ...(kind === 'text' ? { content: content || undefined } : {}),
        ...(kind === 'link' ? { url: url.trim(), content: content || undefined } : {}),
        ...(kind === 'image' ? { url: image!.url, content: content || undefined } : {}),
      });
      toast.success('Posted.');
      router.push(`/v/${chosen}/${res.post.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post.');
    } finally {
      setBusy(false);
    }
  };

  const rules = Array.isArray(space?.rules) ? (space!.rules as string[]) : [];
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Create a post</h1>
        {!spaceName ? (
          <Field label="Where to?" hint={spaces.length ? undefined : 'Join a space first, then you can post in it.'}>
            {(id) => <Select id={id} value={chosen} onChange={(e) => setChosen(e.target.value)}><option value="">Choose a space</option>{spaces.map((s) => <option key={s.name} value={s.name}>v/{s.name}</option>)}</Select>}
          </Field>
        ) : <p className="text-sm text-ink-2">Posting in <Link href={`/v/${spaceName}`} className="link font-semibold">v/{spaceName}</Link></p>}

        <Card>
          <div role="tablist" className="flex border-b border-line">
            {KINDS.map((k) => (
              <button key={k.id} role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)} className={cn('flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition', kind === k.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}><k.icon size={16} /> {k.label}</button>
            ))}
          </div>
          <div className="space-y-4 p-4">
            <Field label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="A clear, specific title" />}</Field>
            {kind === 'link' ? <Field label="Address">{(id) => <Input id={id} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}</Field> : null}
            {kind === 'image' ? (
              <div>
                <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-2">Image</span>
                {image ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.preview} alt="Your upload" className="max-h-72 rounded-md border border-line" />
                    <button onClick={() => setImage(null)} aria-label="Remove image" className="absolute right-2 top-2 rounded bg-bg/80 p-1 hover:bg-bg"><X size={16} /></button>
                  </div>
                ) : (
                  <button onClick={() => file.current?.click()} disabled={uploading} className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-sm text-muted transition hover:border-accent hover:text-ink">
                    <ImagePlus size={24} /> {uploading ? 'Uploading...' : 'Choose a PNG, JPEG, WebP or GIF (up to 5 MB)'}
                  </button>
                )}
                <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
                <p className="mt-1.5 text-xs text-muted">Photos are re-saved without location data.</p>
              </div>
            ) : null}
            <div>
              <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-2">{kind === 'text' ? 'Body (optional)' : 'Description (optional)'}</span>
              <MarkdownEditor value={content} onChange={setContent} rows={8} maxLength={40000} placeholder="Markdown is supported" />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              {flairs.length ? <Field label="Flair" className="min-w-40">{(id) => <Select id={id} value={flairId} onChange={(e) => setFlairId(e.target.value)}><option value="">None</option>{flairs.map((f) => <option key={f.id} value={f.id}>{f.text}</option>)}</Select>}</Field> : null}
              <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm"><input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> Adult content (NSFW)</label>
            </div>
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => router.back()}>Cancel</Button><Button variant="primary" disabled={!valid} loading={busy} onClick={submit}>Post</Button></div>
          </div>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader title="Before you post" />
          <ul className="space-y-2 p-4 text-sm text-ink-2"><li>Be kind, be specific.</li><li>Search first. It may already be answered.</li><li>Moderators must give a reason for any removal, and you can appeal.</li></ul>
        </Card>
        {rules.length ? (
          <Card><CardHeader title={`v/${chosen} rules`} /><ol className="divide-y divide-line">{rules.map((r, i) => <li key={i} className="flex gap-3 px-4 py-2.5 text-sm"><span className="font-mono text-muted">{i + 1}</span><span className="text-ink-2">{String(r)}</span></li>)}</ol></Card>
        ) : null}
      </aside>
    </div>
  );
}
