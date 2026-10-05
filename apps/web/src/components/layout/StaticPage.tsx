import { ReactNode } from 'react';

/** Long-form reading page: a title, a short lede, then sections. */
export function StaticPage({ title, lede, draft, children }: { title: string; lede: string; draft?: boolean; children: ReactNode }) {
  return (
    <article className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-ink-2">{lede}</p>
        {draft ? <p className="mt-3 rounded border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">Draft in plain language. It has not been reviewed by a lawyer and should be before the site opens to the public.</p> : null}
      </header>
      <div className="space-y-5 text-[0.95rem] leading-relaxed text-ink-2 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </article>
  );
}
