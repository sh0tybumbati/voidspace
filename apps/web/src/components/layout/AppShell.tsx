'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Bell, ChevronDown, Compass, Home, LogOut, Menu as MenuIcon, Moon, PenSquare, Plus, Scale, Search, Settings, Shield, Sun, Bookmark, Flame, X, Gavel } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { useLive } from '@/lib/live';
import { useTheme } from '@/lib/theme-context';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { Logo } from '@/components/ui/Misc';

interface MySpace { name: string; displayName: string; isModerator: boolean; isPrivate?: boolean }

const RAIL = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/?feed=hot', label: 'Popular', icon: Flame, match: '/popular' },
  { href: '/spaces', label: 'Explore spaces', icon: Compass },
  { href: '/transparency', label: 'Transparency', icon: Scale },
];

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); if (q.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(q.trim())}`); };
  return (
    <form onSubmit={submit} role="search" className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Voidspace" placeholder="Search posts, spaces and people"
        className="h-9 w-full rounded border border-line bg-surface-2 pl-9 pr-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </form>
  );
}

function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<MySpace[]>([]);
  useEffect(() => {
    if (!user) { setSpaces([]); return; }
    api.get<{ spaces: MySpace[] }>('/api/spaces/mine').then((r) => setSpaces(r.spaces)).catch(() => undefined);
  }, [user, pathname]);

  const item = (href: string, label: string, Icon: typeof Home, active: boolean) => (
    <Link key={href + label} href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
      className={cn('flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition', active ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
      <Icon size={17} className={active ? 'text-accent-text' : ''} /> {label}
    </Link>
  );
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {RAIL.map((r) => item(r.href, r.label, r.icon, r.href === '/' ? pathname === '/' : pathname.startsWith(r.href.split('?')[0]) && r.href !== '/?feed=hot'))}
      {user ? item('/saved', 'Saved', Bookmark, pathname === '/saved') : null}
      {user ? item('/appeals', 'My appeals', Gavel, pathname.startsWith('/appeals')) : null}
      {spaces.length ? (
        <>
          <p className="meta mt-5 px-3 pb-1">Your spaces</p>
          {spaces.slice(0, 12).map((s) => (
            <Link key={s.name} href={`/v/${s.name}`} onClick={onNavigate}
              className={cn('flex items-center gap-2.5 rounded px-3 py-1.5 text-sm transition', pathname.startsWith(`/v/${s.name}`) ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
              <Avatar name={s.name} size={20} /> <span className="truncate">v/{s.name}</span>
              {s.isModerator ? <Shield size={12} className="ml-auto shrink-0 text-accent-text" aria-label="You moderate this space" /> : null}
            </Link>
          ))}
        </>
      ) : null}
    </nav>
  );
}

function Bell_() {
  const { unread } = useLive();
  return (
    <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative grid h-9 w-9 place-items-center rounded text-ink-2 transition hover:bg-surface-2 hover:text-ink">
      <Bell size={18} />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-accent px-1 font-mono text-[0.62rem] font-bold leading-[1.1rem] text-accent-ink animate-ring">{unread > 99 ? '99+' : unread}</span>
      ) : null}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
        <ButtonLink href="/register" variant="primary" size="sm">Sign up</ButtonLink>
      </div>
    );
  }
  return (
    <Menu trigger={({ open, toggle }) => (
      <button onClick={toggle} aria-expanded={open} aria-label="Account menu" className="flex items-center gap-1.5 rounded p-1 transition hover:bg-surface-2">
        <Avatar name={user.username} src={user.avatarUrl} size={28} /> <ChevronDown size={14} className="hidden text-muted sm:block" />
      </button>
    )}>
      {(close) => (
        <>
          <div className="border-b border-line px-3 py-2"><p className="text-sm font-semibold">{user.username}</p><p className="meta">{user.alignment} alignment</p></div>
          <MenuItem href={`/u/${user.username}`} onClick={close}><PenSquare size={15} /> Profile</MenuItem>
          <MenuItem href="/saved" onClick={close}><Bookmark size={15} /> Saved</MenuItem>
          <MenuItem href="/appeals" onClick={close}><Gavel size={15} /> My appeals</MenuItem>
          <MenuItem href="/settings" onClick={close}><Settings size={15} /> Settings</MenuItem>
          {user.isAdmin ? <MenuItem href="/admin" onClick={close}><Shield size={15} /> Admin</MenuItem> : null}
          <MenuItem onClick={() => { toggleTheme(); close(); }}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} {theme === 'dark' ? 'Light theme' : 'Dark theme'}</MenuItem>
          <MenuItem danger onClick={async () => { close(); await logout(); router.push('/'); }}><LogOut size={15} /> Sign out</MenuItem>
        </>
      )}
    </Menu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  useEffect(() => setDrawer(false), [pathname]);

  // Auth pages and the like get the plain shell without the rail.
  const bare = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[88rem] items-center gap-3 px-3 sm:px-5">
          {!bare ? (
            <button onClick={() => setDrawer(true)} aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded text-ink-2 hover:bg-surface-2 lg:hidden"><MenuIcon size={20} /></button>
          ) : null}
          <Link href="/" aria-label="Voidspace home" className="shrink-0"><Logo /></Link>
          <div className="mx-auto hidden flex-1 justify-center px-4 md:flex">{!bare ? <SearchBox /> : null}</div>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            {user && !bare ? (
              <Menu trigger={({ open, toggle }) => (
                <button onClick={toggle} aria-expanded={open} className="mr-1 hidden h-9 items-center gap-1.5 rounded border border-line bg-surface-2 px-3 text-sm font-semibold hover:border-line-strong sm:flex"><Plus size={15} /> Create</button>
              )}>
                {(close) => (
                  <>
                    <MenuItem href="/submit" onClick={close}><PenSquare size={15} /> New post</MenuItem>
                    <MenuItem href="/spaces/create" onClick={close}><Compass size={15} /> New space</MenuItem>
                  </>
                )}
              </Menu>
            ) : null}
            {user ? <Bell_ /> : null}
            <UserMenu />
          </div>
        </div>
        {!bare ? <div className="px-3 pb-2 md:hidden"><SearchBox /></div> : null}
      </header>

      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide overflow-y-auto border-r border-line bg-surface p-3">
            <div className="mb-3 flex items-center justify-between"><Logo /><button onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded p-1.5 text-muted hover:bg-surface-2"><X size={18} /></button></div>
            <Rail onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-[88rem] gap-6 px-3 sm:px-5">
        {!bare ? (
          <aside className="sticky top-[3.5rem] hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto py-5 scroll-thin lg:block"><Rail /></aside>
        ) : null}
        <main id="main" className="min-w-0 flex-1 py-5">{children}</main>
      </div>
      <footer className="border-t border-line px-5 py-6 text-center text-xs text-muted">
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <Link href="/about" className="hover:text-ink">About</Link>
          <Link href="/transparency" className="hover:text-ink">Transparency</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </nav>
        <p className="mt-2">Communities moderate themselves. Every moderator and admin action is public.</p>
      </footer>
    </div>
  );
}
