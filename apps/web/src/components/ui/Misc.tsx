import { formatDistanceToNowStrict } from 'date-fns';
import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-accent', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded bg-[linear-gradient(90deg,rgb(var(--surface-2))_25%,rgb(var(--surface-3))_50%,rgb(var(--surface-2))_75%)] bg-[length:200%_100%]', className)} />;
}

/** A slowly turning ring with an orbiting dot, the logo's motif, holding an icon. Used by empty states. */
export function OrbitArt({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mb-2 flex h-24 w-24 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 96 96" className="absolute inset-0 animate-orbit">
        <circle cx="48" cy="48" r="40" fill="none" stroke="rgb(var(--line-strong))" strokeWidth="1.5" strokeDasharray="3 7" strokeLinecap="round" />
        <circle cx="48" cy="8" r="4" fill="rgb(var(--accent))" />
      </svg>
      <svg viewBox="0 0 96 96" className="absolute inset-0">
        <circle cx="48" cy="48" r="27" fill="rgb(var(--surface-2))" stroke="rgb(var(--line))" />
      </svg>
      <div className="relative text-ink-2">{children ?? <span className="block h-2.5 w-2.5 animate-blink rounded-full bg-accent" />}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex animate-reveal flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <OrbitArt>{icon}</OrbitArt>
      <h3 className="text-base font-semibold">{title}</h3>
      {children ? <p className="max-w-md text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      <span>{message}</span>
      {onRetry ? <button onClick={onRetry} className="font-semibold underline underline-offset-2">Try again</button> : null}
    </div>
  );
}

/** "3 hours ago", with the exact time on hover. */
export function TimeAgo({ date, className }: { date: string | Date; className?: string }) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return <time dateTime={d.toISOString()} title={d.toLocaleString()} className={className}>{formatDistanceToNowStrict(d, { addSuffix: true })}</time>;
}

export function Logo({ size = 28, text = true }: { size?: number; text?: boolean }) {
  return (
    <span className="group inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <g className="origin-center animate-orbit-fast" style={{ transformBox: 'view-box' }}><circle cx="16" cy="16" r="11" fill="none" stroke="rgb(var(--text))" strokeWidth="2.4" strokeDasharray="56 14" strokeLinecap="round" transform="rotate(-50 16 16)" /></g>
        <circle cx="16" cy="16" r="4" fill="rgb(var(--accent))" className="group-hover:animate-blink" />
      </svg>
      {text ? <span className="text-[1.15rem] font-bold lowercase tracking-tight">voidspace</span> : null}
    </span>
  );
}
