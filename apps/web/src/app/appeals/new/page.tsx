'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Gavel } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAsync } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorNotice, Skeleton, TimeAgo } from '@/components/ui/Misc';
import { toast } from '@/components/ui/Toast';

interface ActionInfo { action: { id: string; type: string; reason: string; createdAt: string; space: string; reversed: boolean }; appeal: { id: string; status: string } | null; canAppeal: boolean; windowDays: number }

function NewAppeal() {
  const id = useSearchParams().get('action');
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { data, error, loading } = useAsync(() => api.get<ActionInfo>(`/api/appeals/action/${id}`), [id, user?.id], { enabled: Boolean(id && user) });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!id) return <EmptyState title="Nothing to appeal">Open the link from the notification about the moderation action.</EmptyState>;
  if (!isLoading && !user) return <EmptyState title="Sign in to appeal" action={<Link href={`/login?redirect=/appeals/new?action=${id}`} className="link">Sign in</Link>} />;
  if (loading || isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorNotice message={error ?? 'Could not load that action.'} />;
  const a = data.action;

  const submit = async () => {
    setBusy(true); setProblem(null);
    try { await api.post('/api/appeals', { modActionId: a.id, reason: reason.trim() }); toast.success('Your appeal was sent.'); router.push('/appeals'); }
    catch (e) { setProblem(e instanceof Error ? e.message : 'Could not send the appeal.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <header><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Gavel size={22} className="text-accent-text" /> Appeal a moderation decision</h1></header>
      <div className="rounded-lg border border-line bg-surface p-4"><p className="meta">What happened</p><p className="mt-1 text-sm"><b>{a.type.replace('_', ' ')}</b> in <Link href={`/v/${a.space}`} className="link">v/{a.space}</Link> <TimeAgo date={a.createdAt} className="text-muted" /></p><p className="mt-2 text-sm text-ink-2">The moderator said: {a.reason}</p></div>
      {data.appeal ? <p className="rounded border border-line bg-surface px-4 py-3 text-sm">You already appealed this ({data.appeal.status}). <Link href="/appeals" className="link">See my appeals</Link></p>
        : a.reversed ? <p className="rounded border border-line bg-surface px-4 py-3 text-sm">This decision was already reversed.</p>
        : !data.canAppeal ? <p className="rounded border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">The {data.windowDays}-day window to appeal this has passed.</p>
        : (
          <div className="space-y-4">
            <ul className="space-y-1 text-sm text-ink-2"><li>A different moderator reviews your appeal, never the one who acted.</li><li>If the space has no other moderator, a site admin decides.</li><li>You will be told the outcome, with an explanation.</li></ul>
            <Field label="Why should this be reversed? (at least 20 characters)">{(fid) => <Textarea id={fid} value={reason} onChange={(e) => setReason(e.target.value)} rows={6} maxLength={3000} />}</Field>
            {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => router.back()}>Cancel</Button><Button variant="primary" disabled={reason.trim().length < 20} loading={busy} onClick={submit}>Send appeal</Button></div>
          </div>
        )}
    </div>
  );
}

export default function NewAppealPage() {
  return <Suspense fallback={<Skeleton className="h-64 w-full" />}><NewAppeal /></Suspense>;
}
