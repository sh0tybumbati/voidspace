'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> { id: T; label: ReactNode; count?: number }

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: TabItem<T>[]; value: T; onChange: (id: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_rgb(var(--line))] scroll-thin', className)}>
      {tabs.map((t) => (
        <button
          key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn('relative flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition',
            value === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}
        >
          {t.label}
          {t.count ? <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-2">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
