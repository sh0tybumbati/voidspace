'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ButtonLink } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Misc';
import AuthCard from '@/components/layout/AuthCard';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const { refreshUser } = useAuth();
  const [state, setState] = useState<'working' | 'ok' | 'bad'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setState('bad'); setMessage('This page needs the link from your email.'); return; }
    api.post('/api/auth/verify-email', { token })
      .then(() => { setState('ok'); void refreshUser(); })
      .catch((e: Error) => { setState('bad'); setMessage(e.message); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthCard title="Email verification">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        {state === 'working' ? <Spinner /> : null}
        {state === 'ok' ? <><CheckCircle2 size={36} className="text-ok" /><p className="text-sm text-ink-2">Your email address is verified. You can post and comment.</p><ButtonLink href="/" variant="primary">Go to Voidspace</ButtonLink></> : null}
        {state === 'bad' ? <><XCircle size={36} className="text-danger" /><p className="text-sm text-ink-2">{message}</p><Link href="/settings" className="link text-sm font-semibold">Request a new link in settings</Link></> : null}
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><Verify /></Suspense>;
}
