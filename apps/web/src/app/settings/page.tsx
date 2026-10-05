'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { BadgeCheck, Download, MailWarning, Moon, Sun, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAsync } from '@/lib/hooks';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
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

interface DeletionCheck { blockers: string[]; willClose: string[]; stepDownFrom: string[]; counts: { posts: number; comments: number; uploads: number } }

function DataSection() {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${api.baseApiUrl}/api/account/export`, { headers: { Authorization: `Bearer ${api.getToken()}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Could not export your data.');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = 'voidspace-export.json'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not export your data.'); } finally { setBusy(false); }
  };
  return (
    <Section title="Your data">
      <p className="text-sm text-ink-2">Download everything Voidspace holds about you as one file: your profile, posts, comments, votes, saved items, memberships, reports, appeals and notifications.</p>
      <Button className="mt-4" size="sm" loading={busy} onClick={download}><Download size={14} /> Download my data</Button>
    </Section>
  );
}

function DeleteAccountModal({ username, onClose }: { username: string; onClose: () => void }) {
  const { data, error, loading } = useAsync(() => api.get<DeletionCheck>('/api/account/deletion-check'), []);
  const [password, setPassword] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const blocked = Boolean(data?.blockers.length);

  const submit = async () => {
    setBusy(true); setProblem(null);
    try {
      await api.post('/api/account/delete', { password, deleteContent: wipe });
      api.setToken(null);
      toast.success('Your account was deleted.');
      window.location.assign('/');
    } catch (e) { setProblem(e instanceof Error ? e.message : 'Could not delete the account.'); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Delete your account" wide>
      <div className="space-y-4 text-sm text-ink-2">
        {loading ? <p>Checking...</p> : null}
        {error ? <p role="alert" className="text-danger">{error}</p> : null}
        {data?.blockers.map((b) => <p key={b} role="alert" className="flex gap-2 rounded border border-warn/40 bg-warn/10 p-3 text-warn"><TriangleAlert size={16} className="mt-0.5 shrink-0" />{b}</p>)}
        {data && !blocked ? (
          <>
            <p>This cannot be undone. Your email, password, bio and picture are erased, every device is signed out, and your username is retired. Anything you leave behind shows as <b className="text-ink">[deleted]</b>.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Posts and comments you leave behind stay, shown as &quot;[deleted]&quot;, so conversations still make sense.</li>
              <li>Moderation decisions that involve you stay in the public log under an anonymous name.</li>
              {data.stepDownFrom.length ? <li>You stop being a moderator of {data.stepDownFrom.map((n) => `v/${n}`).join(', ')}.</li> : null}
              {data.willClose.length ? <li><b className="text-ink">{data.willClose.map((n) => `v/${n}`).join(', ')}</b> has no other members, so it closes with your account.</li> : null}
            </ul>
            <label className="flex items-start gap-2.5 rounded border border-line bg-surface-2 p-3">
              <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
              <span>Also erase what I wrote: blank my {data.counts.posts} {data.counts.posts === 1 ? 'post' : 'posts'} and {data.counts.comments} {data.counts.comments === 1 ? 'comment' : 'comments'}, and delete my {data.counts.uploads} uploaded {data.counts.uploads === 1 ? 'image' : 'images'}.</span>
            </label>
            <Field label="Your password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
            <Field label={<>Type <b className="font-mono text-ink">{username}</b> to confirm</>}>{(id) => <Input id={id} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />}</Field>
            {problem ? <p role="alert" className="text-danger">{problem}</p> : null}
          </>
        ) : null}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Keep my account</Button>{data && !blocked ? <Button variant="danger" loading={busy} disabled={!password || confirmName !== username} onClick={submit}><Trash2 size={14} /> Delete forever</Button> : null}</div>
      </div>
    </Modal>
  );
}

function DangerSection() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <section className="rounded-lg border border-danger/40 bg-surface p-5">
      <h2 className="text-base font-semibold text-danger">Delete account</h2>
      <p className="mt-2 text-sm text-ink-2">Erase your account and personal details. You can choose to erase your posts and comments too.</p>
      <Button className="mt-4" size="sm" variant="danger" onClick={() => setOpen(true)}>Delete my account...</Button>
      {open ? <DeleteAccountModal username={user.username} onClose={() => setOpen(false)} /> : null}
    </section>
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
      <DataSection />
      <Section title="Appearance">
        <div className="flex items-center justify-between"><p className="text-sm text-ink-2">Theme: <b>{theme}</b></p><Button size="sm" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} Switch to {theme === 'dark' ? 'light' : 'dark'}</Button></div>
      </Section>
      <DangerSection />
    </div>
  );
}
