'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { BadgeCheck, MailWarning, Moon, Sun, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/Misc';
import { toast } from '@/components/ui/Toast';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="p-5"><h2 className="mb-4 text-base font-semibold">{title}</h2>{children}</Card>;
}

function ProfileSection() {
  const { user, refreshUser } = useAuth();
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try { setAvatar((await api.uploadImage(f)).url); } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed.'); } finally { setUploading(false); if (file.current) file.current.value = ''; }
  };
  const save = async () => {
    setBusy(true);
    try { await api.updateProfile(user.username, { bio: bio.trim() || null, avatarUrl: avatar }); await refreshUser(); toast.success('Profile saved.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  };

  return (
    <Section title="Profile">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.username} src={api.assetUrl(avatar)} size={64} />
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <Button size="sm" loading={uploading} onClick={() => file.current?.click()}><Upload size={14} /> Upload picture</Button>
            {avatar ? <Button size="sm" variant="ghost" onClick={() => setAvatar(null)}>Remove</Button> : null}
          </div>
        </div>
        <Field label="Bio" hint={`${bio.length} / 500`}>{(id) => <Textarea id={id} rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />}</Field>
        <div className="flex justify-end"><Button variant="primary" loading={busy} onClick={save}>Save profile</Button></div>
      </div>
    </Section>
  );
}

function EmailSection() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  if (!user) return null;
  const send = async () => {
    setSending(true);
    try { const r = await api.post<{ message: string }>('/api/auth/resend-verification'); toast.success(r.message); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not send.'); } finally { setSending(false); }
  };
  return (
    <Section title="Email">
      <p className="font-mono text-sm">{user.email}</p>
      {user.emailVerifiedAt ? <p className="mt-2 flex items-center gap-1.5 text-sm text-ok"><BadgeCheck size={16} /> Verified</p> : (
        <div className="mt-2 flex flex-wrap items-center gap-3"><p className="flex items-center gap-1.5 text-sm text-warn"><MailWarning size={16} /> Not verified yet</p><Button size="sm" loading={sending} onClick={send}>Send a verification link</Button></div>
      )}
      <p className="mt-3 text-xs text-muted">We use your email only for verification and password resets.</p>
    </Section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await api.changePassword(current, next);
      if (r.token) api.setToken(r.token);
      setCurrent(''); setNext(''); toast.success('Password changed. Other devices were signed out.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change the password.'); } finally { setBusy(false); }
  };
  return (
    <Section title="Password">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Current password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
        <Field label="New password" hint="At least 8 characters. Changing it signs out every other device.">{(id) => <Input id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}</Field>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end"><Button type="submit" variant="primary" loading={busy} disabled={!current || next.length < 8}>Change password</Button></div>
      </form>
    </Section>
  );
}

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  if (!isLoading && !user) return <EmptyState title="Sign in to change your settings" action={<Link href="/login?redirect=/settings" className="link">Sign in</Link>} />;
  if (!user) return null;
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <ProfileSection />
      <EmailSection />
      <PasswordSection />
      <Section title="Appearance">
        <div className="flex items-center justify-between"><p className="text-sm text-ink-2">Theme: <b>{theme}</b></p><Button size="sm" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} Switch to {theme === 'dark' ? 'light' : 'dark'}</Button></div>
      </Section>
    </div>
  );
}
