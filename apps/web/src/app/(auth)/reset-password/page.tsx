'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import AuthCard from '@/components/layout/AuthCard';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== again) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError(null);
    try { await api.post('/api/auth/reset-password', { token, password }); api.setToken(null); toast.success('Password changed. Sign in with the new one.'); router.push('/login'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not reset your password.'); }
    finally { setBusy(false); }
  };

  if (!token) return <AuthCard title="Link missing" footer={<Link href="/forgot-password" className="link font-semibold">Request a new link</Link>}><p className="text-sm text-ink-2">This page needs the link from your email.</p></AuthCard>;
  return (
    <AuthCard title="Choose a new password" subtitle="You will be signed out everywhere else.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">{(id) => <Input id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />}</Field>
        <Field label="Repeat it">{(id) => <Input id={id} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />}</Field>
        {error ? <p role="alert" className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>Change password</Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetForm /></Suspense>;
}
