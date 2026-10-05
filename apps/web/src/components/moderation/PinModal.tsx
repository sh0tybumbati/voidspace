'use client';

import { useState } from 'react';
import { Pin } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAsync } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';

const MAX_PINS = 2;

/** Pin a post to the top of its space. When both slots are taken, choose which pin to replace. */
export function PinModal({ space, postId, onClose, onDone }: { space: string; postId: string; onClose: () => void; onDone: () => void }) {
  const { data, error, loading } = useAsync(() => api.get<{ posts: { id: string; title: string }[] }>(`/api/spaces/${space}/pinned`), [space]);
  const [replace, setReplace] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const full = (data?.posts.length ?? 0) >= MAX_PINS;

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/api/mod/pin-post', { postId, reason: reason.trim() || undefined, replacePostId: full ? replace ?? undefined : undefined });
      toast.success('Pinned.');
      onClose(); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not pin the post.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Pin to the top of the space">
      <div className="space-y-4 text-sm text-ink-2">
        {error ? <p role="alert" className="text-danger">{error}</p> : null}
        {full ? (
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-1">A space holds {MAX_PINS} pinned posts. Pick one to replace:</legend>
            {data?.posts.map((p) => (
              <label key={p.id} className={cn('flex min-w-0 cursor-pointer items-center gap-2.5 rounded border p-3', replace === p.id ? 'border-accent bg-accent/5 text-ink' : 'border-line bg-surface-2')}>
                <input type="radio" name="replace" checked={replace === p.id} onChange={() => setReplace(p.id)} className="accent-[rgb(var(--accent))]" />
                <Pin size={13} className="shrink-0 text-ok" /><span className="truncate">{p.title}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <Field label="Why? (optional)" hint="Shown in the public mod log next to your name.">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Weekly thread, read first" />}</Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={loading || Boolean(error) || (full && !replace)} onClick={submit}><Pin size={14} /> Pin post</Button></div>
      </div>
    </Modal>
  );
}
