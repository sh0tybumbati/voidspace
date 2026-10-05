'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync } from '@/lib/hooks';
import type { Space } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { ImagePicker } from '@/components/ui/ImagePicker';
import { EmptyState, ErrorNotice, Skeleton } from '@/components/ui/Misc';
import { toast } from '@/components/ui/Toast';

interface SpaceResponse { space: Space; permissions?: Record<string, boolean> | null }

export default function SpaceSettingsPage() {
  const { name } = useParams<{ name: string }>();
  const { user, isLoading } = useAuth();
  const { data, error, loading } = useAsync(() => api.get<SpaceResponse>(`/api/spaces/${name}`), [name, user?.id], { enabled: !isLoading });
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [sidebar, setSidebar] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sp = data?.space; if (!sp) return;
    setDisplayName(sp.displayName); setDescription(sp.description ?? ''); setSidebar(sp.sidebarContent ?? ''); setIcon(sp.iconUrl ?? null); setBanner(sp.bannerUrl ?? null);
  }, [data]);

  if (loading || isLoading) return <Skeleton className="h-64 max-w-2xl" />;
  if (error || !data) return <ErrorNotice message={error ?? 'Could not load this space.'} />;
  const perms = data.permissions;
  if (!user || !(perms?.all || perms?.edit_space)) return <EmptyState title="Founders only" action={<Link href={`/v/${name}`} className="link">Back to v/{name}</Link>}>Only the founder, or a moderator they have given permission, can change how the space looks.</EmptyState>;

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/spaces/${name}`, { displayName: displayName.trim(), description, sidebarContent: sidebar, iconUrl: icon, bannerUrl: banner });
      toast.success('Saved.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <header><p className="meta"><Link href={`/v/${name}`} className="hover:text-ink">v/{name}</Link> / settings</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Space settings</h1></header>
      <ImagePicker label="Icon" shape="round" value={icon} onChange={setIcon} hint="Shown next to the name and in lists. Square images work best." fallback={<Avatar name={name} size={80} />} />
      <ImagePicker label="Banner" value={banner} onChange={setBanner} hint="Wide pictures work best, around 4 to 1. Text on top is kept readable automatically." />
      <Field label="Display name">{(id) => <Input id={id} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} />}</Field>
      <Field label="Description">{(id) => <Textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />}</Field>
      <Field label="Sidebar" hint="Markdown. Shown under the description.">{(id) => <Textarea id={id} rows={6} value={sidebar} onChange={(e) => setSidebar(e.target.value)} maxLength={10000} />}</Field>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => history.back()}>Back</Button><Button variant="primary" loading={busy} disabled={displayName.trim().length < 3} onClick={save}>Save changes</Button></div>
    </div>
  );
}
