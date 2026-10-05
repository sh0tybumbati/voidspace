'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** A small dropdown. The trigger gets aria-expanded; clicking outside or pressing Escape closes it. */
export function Menu({ trigger, children, align = 'right', className }: { trigger: (props: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open ? (
        <div className={cn('absolute z-40 mt-2 min-w-48 animate-rise rounded-lg border border-line-strong bg-surface-2 p-1 shadow-2xl', align === 'right' ? 'right-0' : 'left-0', className)} role="menu">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ children, onClick, href, danger }: { children: ReactNode; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = cn('flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm transition hover:bg-surface-3', danger ? 'text-danger' : 'text-ink');
  return href ? <a href={href} role="menuitem" className={cls} onClick={onClick}>{children}</a> : <button role="menuitem" className={cls} onClick={onClick}>{children}</button>;
}
