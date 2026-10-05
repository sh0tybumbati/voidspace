'use client';

import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

/** Run an async function and track its state. `reload()` runs it again. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const run = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === run.current) { setData(result); setError(null); }
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, error, loading, reload: load, setData };
}

/** Debounce a changing value. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
