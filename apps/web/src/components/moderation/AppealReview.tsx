'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { AppealView } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';

type Decision = 'approve' | 'deny' | 'escalate';
const COPY: Record<Decision, { title: string; hint: string; button: string; variant: 'primary' | 'danger' | 'secondary' }> = {
  approve: { title: 'Approve this appeal', hint: 'The original action is reversed, the person is told, and the public log shows it as reversed.', button: 'Approve and reverse', variant: 'primary' },
  deny: { title: 'Deny this appeal', hint: 'Explain why. The person sees your explanation.', button: 'Deny appeal', variant: 'danger' },
  escalate: { title: 'Escalate to the site admins', hint: 'Use this if you think the original moderator acted in bad faith. Say why.', button: 'Escalate', variant: 'secondary' },
};

/** Review an appeal. Used from the mod queue (moderators) and the admin page (escalated appeals). */
export function AppealReviewModal({ appeal, decision, onClose, onDone, admin }: { appeal: AppealView; decision: Decision; onClose: () => void; onDone: () => void; admin?: boolean }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const c = COPY[decision];
  const min = admin ? 20 : decision === 'deny' ? 10 : 0;

  const submit = async () => {
    setBusy(true);
    try {
      if (admin) await api.post(`/api/appeals/admin/${appeal.id}/resolve`, { decision, justification: notes.trim() });
      else await api.post(`/api/appeals/${appeal.id}/review`, { decision, notes: notes.trim() || undefined });
      toast.success('Done.');
      onClose(); onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save your decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={c.title}>
      <p className="mb-3 text-sm text-ink-2">{c.hint}{admin ? ' Your justification is published on the transparency page.' : ''}</p>
      <Field label={admin ? 'Public justification (at least 20 characters)' : decision === 'deny' ? 'Explanation (at least 10 characters)' : 'Notes (optional)'}>
        {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={2000} />}
      </Field>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={c.variant} disabled={notes.trim().length < min} loading={busy} onClick={submit}>{c.button}</Button></div>
    </Modal>
  );
}
