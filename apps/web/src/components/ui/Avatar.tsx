import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

/** A stable colour from a name, so the same person always looks the same. */
export function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ name, src, size = 32, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const hue = hueOf(name);
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.42) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={api.assetUrl(src)} alt="" style={style} className={cn('shrink-0 rounded-full object-cover', className)} />;
  }
  return (
    <span
      aria-hidden
      style={{ ...style, background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 50) % 360} 70% 32%))` }}
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold uppercase text-white', className)}
    >
      {name.slice(0, 1)}
    </span>
  );
}
