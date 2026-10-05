'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';

/** Moderators must give a reason, which becomes part of the public mod log and is shown to the author. */
export function RemoveModal({ open, onClose, targetType, targetId, onRemoved }: { open: boolean; onClose: () => void; targetType: 'post' | 'comment'; targetId: string; onRemoved: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = reason.trim().length >= 10;

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/api/mod/remove-${targetType}`, targetType === 'post' ? { postId: targetId, reason: reason.trim() } : { commentId: targetId, reason: reason.trim() });
      toast.success(`The ${targetType} was removed and logged publicly.`);
      setReason('');
      onClose();
      onRemoved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove it.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Remove this ${targetType}`}>
      <p className="mb-3 text-sm text-ink-2">Your reason is shown in the public mod log and sent to the author, who can appeal to a different moderator.</p>
      <Field label="Reason (at least 10 characters)">
        {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Which rule does it break?" />}
      </Field>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={!ok} loading={busy} onClick={submit}>Remove and log</Button></div>
    </Modal>
  );
}
