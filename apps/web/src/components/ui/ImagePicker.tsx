'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';

/** Choose, preview and remove one uploaded picture. `value` is the stored path (or null). */
export function ImagePicker({ label, hint, value, onChange, shape = 'wide', fallback }: {
  label: string; hint?: string; value: string | null; onChange: (path: string | null) => void; shape?: 'wide' | 'round'; fallback?: React.ReactNode;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { onChange((await api.uploadImage(f)).url); } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className={cn('grid shrink-0 place-items-center overflow-hidden border border-line bg-surface-2', shape === 'round' ? 'h-20 w-20 rounded-full' : 'h-24 w-72 max-w-full rounded-lg')}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={api.assetUrl(value)} alt="" className="h-full w-full object-cover" />
          ) : fallback ?? <ImagePlus size={22} className="text-muted" />}
        </div>
        <div className="space-y-2">
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={() => file.current?.click()}><ImagePlus size={14} /> {value ? 'Replace' : 'Upload'}</Button>
            {value ? <Button size="sm" variant="ghost" onClick={() => onChange(null)}><Trash2 size={14} /> Remove</Button> : null}
          </div>
          {hint ? <p className="max-w-xs text-xs text-muted">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
