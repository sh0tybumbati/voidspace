'use client';

import { useId, useRef, useState } from 'react';
import { Bold, Code, Italic, Link2, List, Quote } from 'lucide-react';
import { cn } from '@/lib/cn';
import MarkdownRenderer from './MarkdownRenderer';

/** A textarea with a small formatting toolbar and a live preview. */
export default function MarkdownEditor({ value, onChange, placeholder, rows = 6, maxLength, id, className, invalid }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; maxLength?: number; id?: string; className?: string; invalid?: boolean;
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const ref = useRef<HTMLTextAreaElement>(null);
  const auto = useId();

  /** Wrap the selection (or insert at the cursor) with markdown syntax. */
  const wrap = (before: string, after = before, fallback = 'text') => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + before.length, start + before.length + selected.length); });
  };
  const linePrefix = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    onChange(value.slice(0, start) + prefix + value.slice(start));
    requestAnimationFrame(() => el.focus());
  };

  const tools = [
    { label: 'Bold', icon: Bold, run: () => wrap('**') },
    { label: 'Italic', icon: Italic, run: () => wrap('*') },
    { label: 'Link', icon: Link2, run: () => wrap('[', '](https://)', 'link text') },
    { label: 'Quote', icon: Quote, run: () => linePrefix('> ') },
    { label: 'Code', icon: Code, run: () => wrap('`') },
    { label: 'List', icon: List, run: () => linePrefix('- ') },
  ];

  return (
    <div className={cn('overflow-hidden rounded border bg-surface-2 transition focus-within:border-accent focus-within:ring-1 focus-within:ring-accent', invalid ? 'border-danger' : 'border-line', className)}>
      <div className="flex items-center justify-between border-b border-line px-2 py-1">
        <div className="flex gap-0.5" role="toolbar" aria-label="Formatting">
          {tools.map((t) => (
            <button key={t.label} type="button" onClick={t.run} disabled={mode === 'preview'} aria-label={t.label} title={t.label}
              className="grid h-7 w-7 place-items-center rounded text-muted transition hover:bg-surface-3 hover:text-ink disabled:opacity-40"><t.icon size={15} /></button>
          ))}
        </div>
        <div className="flex gap-1 text-xs font-medium">
          {(['write', 'preview'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
              className={cn('rounded px-2.5 py-1 capitalize transition', mode === m ? 'bg-surface-3 text-ink' : 'text-muted hover:text-ink')}>{m}</button>
          ))}
        </div>
      </div>
      {mode === 'write' ? (
        <textarea ref={ref} id={id ?? auto} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} maxLength={maxLength}
          className="block w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted focus:outline-none" />
      ) : (
        <div className="min-h-[8rem] px-3 py-2.5">{value.trim() ? <MarkdownRenderer content={value} /> : <p className="text-sm text-muted">Nothing to preview yet.</p>}</div>
      )}
      {maxLength ? <div className="border-t border-line px-3 py-1 text-right font-mono text-[0.68rem] text-muted tabular">{value.length}/{maxLength}</div> : null}
    </div>
  );
}
