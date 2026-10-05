import { ReactNode } from 'react';
import { Logo } from '@/components/ui/Misc';

/** The centred card used by sign-in, sign-up and the password and email pages. */
export default function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-6">
      <div className="mb-6 flex justify-center"><Logo size={36} /></div>
      <div className="rounded-xl border border-line bg-surface p-6 shadow-xl sm:p-8">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <p className="mt-5 text-center text-sm text-ink-2">{footer}</p> : null}
    </div>
  );
}
