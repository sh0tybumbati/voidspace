'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import AuthCard from '@/components/layout/AuthCard';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.post('/api/auth/forgot-password', { email: email.trim() }); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  return (
    <AuthCard title="Reset your password" subtitle="We will email you a link that works for one hour." footer={<Link href="/login" className="link font-semibold">Back to sign in</Link>}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center"><MailCheck size={32} className="text-accent-text" /><p className="text-sm text-ink-2">If that address has an account, a reset link is on its way. Check your spam folder too.</p></div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}</Field>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthCard>
  );
}
