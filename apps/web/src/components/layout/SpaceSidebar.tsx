'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Cake, Gavel, Scale, ScrollText, Shield, Users, Vote } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Space } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { toast } from '@/components/ui/Toast';

/** The right-hand column of a space: what it is, its rules, who runs it, and where to see how it is governed. */
export default function SpaceSidebar({ space, isSubscribed, isModerator, onChanged }: { space: Space; isSubscribed: boolean; isModerator: boolean; onChanged: (joined: boolean) => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!user) { toast.info('Sign in to join spaces.', '/login'); return; }
    setBusy(true);
    try {
      await (isSubscribed ? api.unsubscribeFromSpace(space.name) : api.subscribeToSpace(space.name));
      onChanged(!isSubscribed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update your membership.');
    } finally {
      setBusy(false);
    }
  };

  const rules = Array.isArray(space.rules) ? space.rules : [];
  return (
    <div className="space-y-4">
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Avatar name={space.name} size={44} />
            <div className="min-w-0"><h2 className="truncate font-semibold">{space.displayName}</h2><p className="meta">v/{space.name}</p></div>
          </div>
          {space.description ? <p className="mt-3 text-sm text-ink-2">{space.description}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-muted">
            <span className="flex items-center gap-1.5"><Users size={14} /> <b className="font-mono text-ink">{space.subscriberCount}</b> members</span>
            <span className="flex items-center gap-1.5"><Cake size={14} /> {format(new Date(space.createdAt), 'MMM d, yyyy')}</span>
          </div>
          <div className="mt-4 grid gap-2">
            <Button variant={isSubscribed ? 'secondary' : 'primary'} loading={busy} onClick={toggle}>{isSubscribed ? 'Leave space' : 'Join space'}</Button>
            {user && (isSubscribed || isModerator) ? <ButtonLink href={`/v/${space.name}/submit`} variant="outline">Create post</ButtonLink> : null}
          </div>
        </div>
        {space.sidebarContent ? <div className="border-t border-line p-4"><MarkdownRenderer content={space.sidebarContent} /></div> : null}
      </Card>

      {rules.length ? (
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ScrollText size={15} /> Rules</span>} />
          <ol className="divide-y divide-line">{rules.map((r, i) => <li key={i} className="flex gap-3 px-4 py-2.5 text-sm"><span className="font-mono text-muted tabular">{i + 1}</span><span className="text-ink-2">{String(r)}</span></li>)}</ol>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Shield size={15} /> Moderators</span>} />
        <ul className="p-2">
          {(space.moderators ?? []).map((m) => (
            <li key={m.username}><Link href={`/u/${m.username}`} className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-surface-2"><Avatar name={m.username} size={22} /> {m.username}{m.isFounder ? <span className="meta ml-auto">founder</span> : null}</Link></li>
          ))}
        </ul>
        <div className="grid gap-0.5 border-t border-line p-2 text-sm">
          <Link href={`/v/${space.name}/governance`} className="flex items-center gap-2.5 rounded px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink"><Vote size={15} /> Governance and elections</Link>
          <Link href={`/v/${space.name}/modlog`} className="flex items-center gap-2.5 rounded px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink"><Scale size={15} /> Public mod log</Link>
          {isModerator ? <Link href={`/v/${space.name}/mod`} className="flex items-center gap-2.5 rounded px-2 py-1.5 font-medium text-accent-text hover:bg-surface-2"><Gavel size={15} /> Mod queue</Link> : null}
        </div>
      </Card>
    </div>
  );
}
