import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'danger' | 'warn' | 'ok' | 'info';
const tones: Record<Tone, string> = {
  neutral: 'border-line text-ink-2',
  accent: 'border-accent/40 bg-accent/10 text-accent-text',
  danger: 'border-danger/40 bg-danger/10 text-danger',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  ok: 'border-ok/40 bg-ok/10 text-ok',
  info: 'border-info/40 bg-info/10 text-info',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold uppercase tracking-wide', tones[tone], className)}>{children}</span>;
}
