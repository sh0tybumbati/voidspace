'use client';

import { create } from 'zustand';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; message: string; href?: string }
interface Store { items: ToastItem[]; push: (kind: Kind, message: string, href?: string) => void; dismiss: (id: number) => void }

let next = 1;
const useToastStore = create<Store>((set, get) => ({
  items: [],
  push: (kind, message, href) => {
    const id = next++;
    set((s) => ({ items: [...s.items.slice(-3), { id, kind, message, href }] }));
    setTimeout(() => get().dismiss(id), kind === 'error' ? 7000 : 4500);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string, href?: string) => useToastStore.getState().push('success', m, href),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string, href?: string) => useToastStore.getState().push('info', m, href),
};

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const colors = { success: 'text-ok', error: 'text-danger', info: 'text-info' };

export function Toaster() {
  const { items, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => {
        const Icon = icons[t.kind];
        const body = <span className="min-w-0 flex-1 text-sm">{t.message}</span>;
        return (
          <div key={t.id} className="pointer-events-auto flex animate-slide items-start gap-3 rounded-lg border border-line-strong bg-surface-2 p-3 shadow-xl">
            <Icon size={18} className={`mt-0.5 shrink-0 ${colors[t.kind]}`} />
            {t.href ? <a href={t.href} className="min-w-0 flex-1 text-sm hover:underline">{t.message}</a> : body}
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-ink"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}
