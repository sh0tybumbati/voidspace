import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Deleted accounts live on as "deleted_xxxx"; show them as "[deleted]" and do not link to a profile. */
export const isDeletedName = (name: string) => name.startsWith('deleted_');

export function UserLink({ name, className }: { name: string; className?: string }) {
  if (isDeletedName(name)) return <span className={cn('text-muted', className)} title="This account was deleted">[deleted]</span>;
  return <Link href={`/u/${name}`} className={className}>{name}</Link>;
}
