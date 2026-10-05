'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import AuthCard from '@/components/layout/AuthCard';

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const checks = [
    { ok: form.password.length >= 8, label: 'At least 8 characters' },
    { ok: form.password.length > 0 && !form.password.toLowerCase().includes(form.username.toLowerCase().slice(0, 4)) || form.username.length < 4, label: 'Does not contain your username' },
  ];
  const usernameOk = /^[a-zA-Z0-9_]{3,50}$/.test(form.username);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.register(form.username.trim(), form.email.trim(), form.password);
      await login(form.username.trim(), form.password);
      toast.success('Welcome to Voidspace. Check your email to verify your address.');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create your account" subtitle="Free, and no ads between you and the conversation." footer={<>Already a member? <Link href="/login" className="link font-semibold">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username" hint="Letters, numbers and underscores." error={form.username && !usernameOk ? 'Use 3 to 50 letters, numbers or underscores.' : null}>{(id) => <Input id={id} autoComplete="username" value={form.username} onChange={set('username')} required autoFocus />}</Field>
        <Field label="Email" hint="Used to verify your account and reset your password. It is never shown.">{(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} required />}</Field>
        <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />}</Field>
        <ul className="space-y-1 text-xs">{checks.map((c) => <li key={c.label} className={cn('flex items-center gap-1.5', c.ok ? 'text-ok' : 'text-muted')}>{c.ok ? <Check size={13} /> : <X size={13} />} {c.label}</li>)}</ul>
        <p className="text-xs text-muted">By signing up you agree to the <Link href="/terms" className="link">terms</Link> and <Link href="/privacy" className="link">privacy policy</Link>.</p>
        {error ? <p role="alert" className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!usernameOk}>Create account</Button>
      </form>
    </AuthCard>
  );
}
