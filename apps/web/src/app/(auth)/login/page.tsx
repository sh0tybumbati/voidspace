'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import AuthCard from '@/components/layout/AuthCard';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await login(username.trim(), password);
      const next = params.get('redirect');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to vote, comment and join in." footer={<>New here? <Link href="/register" className="link font-semibold">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">{(id) => <Input id={id} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />}</Field>
        <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
        <div className="text-right"><Link href="/forgot-password" className="text-xs text-muted hover:text-ink hover:underline">Forgot your password?</Link></div>
        {error ? <p role="alert" className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
