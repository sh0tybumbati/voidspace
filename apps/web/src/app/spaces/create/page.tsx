'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';

export default function CreateSpacePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<string[]>(['']);
  const [nsfw, setNsfw] = useState<'none' | 'partial' | 'full'>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!isLoading && !user) router.push('/login?redirect=/spaces/create'); }, [user, isLoading, router]);
  if (!user) return null;

  const nameError = name && !/^[a-z0-9_]{3,50}$/.test(name) ? 'Use 3 to 50 lowercase letters, numbers or underscores.' : null;
  const ok = !nameError && name.length >= 3 && displayName.trim().length >= 3;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await api.createSpace({ name, displayName: displayName.trim(), description: description.trim() || undefined, rules: rules.map((r) => r.trim()).filter(Boolean), isNsfw: nsfw !== 'none', nsfwType: nsfw });
      toast.success(`v/${name} is live.`);
      router.push(`/v/${name}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the space.'); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5">
      <header><h1 className="text-2xl font-bold tracking-tight">Create a space</h1><p className="mt-1 text-sm text-ink-2">You start as the founder and first moderator. Once the space has members, they can vote in more moderators, and vote on its rules.</p></header>
      <Field label="Address" hint="This is permanent. It appears as v/name." error={nameError}>{(id) => (
        <div className="flex items-center gap-2"><span className="font-mono text-muted">v/</span><Input id={id} value={name} onChange={(e) => setName(e.target.value.toLowerCase())} maxLength={50} placeholder="gardening" /></div>
      )}</Field>
      <Field label="Display name">{(id) => <Input id={id} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} placeholder="Gardening" />}</Field>
      <Field label="Description">{(id) => <Textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />}</Field>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Rules</legend>
        {rules.map((r, i) => (
          <div key={i} className="flex gap-2"><span className="w-5 pt-2 text-right font-mono text-xs text-muted">{i + 1}</span><Input aria-label={`Rule ${i + 1}`} value={r} onChange={(e) => setRules((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))} maxLength={300} />{rules.length > 1 ? <Button type="button" variant="ghost" size="sm" aria-label="Remove rule" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}><Trash2 size={14} /></Button> : null}</div>
        ))}
        {rules.length < 10 ? <Button type="button" size="sm" variant="ghost" onClick={() => setRules((rs) => [...rs, ''])}><Plus size={14} /> Add a rule</Button> : null}
      </fieldset>
      <Field label="Adult content">{(id) => <Select id={id} value={nsfw} onChange={(e) => setNsfw(e.target.value as typeof nsfw)}><option value="none">None</option><option value="partial">Some posts are 18+</option><option value="full">The whole space is 18+</option></Select>}</Field>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button><Button type="submit" variant="primary" disabled={!ok} loading={busy}>Create space</Button></div>
    </form>
  );
}
