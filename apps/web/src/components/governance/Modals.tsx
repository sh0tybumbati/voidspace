'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { VOTE_LABELS } from './Cards';

export function StartElectionModal({ open, onClose, space, mode, preset, onDone }: { open: boolean; onClose: () => void; space: string; mode: 'add_mod' | 'remove_mod'; preset?: string; onDone: () => void }) {
  const [candidate, setCandidate] = useState(preset ?? '');
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = mode === 'remove_mod';
  const ok = remove ? candidate.trim() && justification.trim().length >= 20 : true;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/api/spaces/${space}/elections`, { type: mode, candidate: candidate.trim() || undefined, justification: justification.trim() || undefined });
      toast.success('Election started. Voting opens after the nomination period.');
      onClose(); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the election.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={remove ? 'Propose removing a moderator' : 'Stand for moderator, or nominate someone'}>
      <div className="space-y-4">
        <Field label={remove ? 'Moderator username' : 'Username (leave blank to stand yourself)'}>{(id) => <Input id={id} value={candidate} onChange={(e) => setCandidate(e.target.value)} placeholder={remove ? 'username' : 'yourself'} />}</Field>
        <Field label={remove ? 'Why? (public, at least 20 characters)' : 'Why they would be a good moderator (optional)'}>{(id) => <Textarea id={id} value={justification} onChange={(e) => setJustification(e.target.value)} rows={4} maxLength={3000} />}</Field>
        <p className="text-xs text-muted">A 3-day {remove ? 'discussion' : 'nomination'} period comes first, then 7 days of voting.</p>
        {error ? <p role="alert" className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} loading={busy} onClick={submit}>Start</Button></div>
      </div>
    </Modal>
  );
}

export function StartVoteModal({ open, onClose, space, currentRules, onDone }: { open: boolean; onClose: () => void; space: string; currentRules: string[]; onDone: () => void }) {
  const [type, setType] = useState('change_rules');
  const [title, setTitle] = useState('');
  const [proposal, setProposal] = useState('');
  const [rules, setRules] = useState<string[]>(currentRules.length ? currentRules : ['']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/api/spaces/${space}/votes`, { voteType: type, title: title.trim(), proposal: proposal.trim(), ...(type === 'change_rules' ? { payload: { rules: rules.map((r) => r.trim()).filter(Boolean) } } : {}) });
      toast.success('Vote started. Voting opens after the discussion period.');
      onClose(); onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the vote.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Propose a community vote" wide>
      <div className="space-y-4">
        <Field label="What should the community decide?">{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(VOTE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Title (5 to 150 characters)">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />}</Field>
        <Field label="Explain the proposal (at least 20 characters)">{(id) => <Textarea id={id} value={proposal} onChange={(e) => setProposal(e.target.value)} rows={4} maxLength={5000} />}</Field>
        {type === 'change_rules' ? (
          <fieldset>
            <legend className="mb-1.5 text-[0.8rem] font-medium text-ink-2">The new rules (replace the current ones if this passes)</legend>
            <div className="space-y-2">
              {rules.map((r, i) => (
                <div key={i} className="flex gap-2"><span className="mt-2.5 w-5 font-mono text-xs text-muted">{i + 1}</span><Input value={r} onChange={(e) => setRules((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))} maxLength={300} aria-label={`Rule ${i + 1}`} />{rules.length > 1 ? <button onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove rule ${i + 1}`} className="px-2 text-muted hover:text-danger"><X size={16} /></button> : null}</div>
              ))}
            </div>
            {rules.length < 20 ? <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRules((rs) => [...rs, ''])}><Plus size={14} /> Add a rule</Button> : null}
          </fieldset>
        ) : null}
        <p className="text-xs text-muted">3 days of discussion, then 7 days of voting. It needs 60% yes and 15% of members voting. Moderators cannot veto it.</p>
        {error ? <p role="alert" className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={title.trim().length < 5 || proposal.trim().length < 20} loading={busy} onClick={submit}>Start vote</Button></div>
      </div>
    </Modal>
  );
}
