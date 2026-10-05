'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';

export const REPORT_CATEGORIES = [
  { id: 'spam', label: 'Spam or advertising' },
  { id: 'harassment', label: 'Harassment or threats' },
  { id: 'hate', label: 'Hate or abuse' },
  { id: 'nsfw_unmarked', label: 'Adult content that is not marked' },
  { id: 'illegal', label: 'Illegal content (also goes to site admins)' },
  { id: 'other', label: 'Something else' },
];

export function ReportModal({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: 'post' | 'comment' | 'user'; targetId: string }) {
  const [category, setCategory] = useState('spam');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/api/reports', { targetType, targetId, category, reason: reason.trim() || undefined });
      toast.success('Thanks. Your report was sent to the moderators.');
      setReason('');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Report this ${targetType}`}>
      <fieldset className="space-y-1.5">
        <legend className="mb-2 text-sm text-ink-2">What is wrong with it?</legend>
        {REPORT_CATEGORIES.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded border border-line px-3 py-2 text-sm transition has-[:checked]:border-accent has-[:checked]:bg-accent/5 hover:bg-surface-2">
            <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} className="accent-[rgb(var(--accent))]" /> {c.label}
          </label>
        ))}
      </fieldset>
      <Field label="Anything else the moderators should know? (optional)" className="mt-4">
        {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} />}
      </Field>
      <p className="mt-3 text-xs text-muted">Reports are not shown to the person you report. Moderators decide, and every decision is logged publicly.</p>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Send report</Button></div>
    </Modal>
  );
}
