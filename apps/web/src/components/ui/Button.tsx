import Link from 'next/link';
import { ButtonHTMLAttributes, ComponentProps, forwardRef } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const base = 'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110',
  secondary: 'border border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3',
  outline: 'border border-line-strong text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110',
};
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-[0.8rem]', md: 'h-9 px-4 text-sm', lg: 'h-11 px-6 text-[0.95rem]' };

export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md', extra?: string) => cn(base, variants[variant], sizes[size], extra);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean }

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} type="button" disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'secondary', size = 'md', className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
