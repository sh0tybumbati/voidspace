'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth-context';
import type { Notification } from './types';
import { toast } from '@/components/ui/Toast';

interface LiveContextType {
  unread: number;
  setUnread: (n: number | ((n: number) => number)) => void;
  /** Called with each notification as it arrives over the live connection. */
  onNotification: (fn: (n: Notification) => void) => () => void;
}

const LiveContext = createContext<LiveContextType>({ unread: 0, setUnread: () => {}, onNotification: () => () => {} });

/**
 * Keeps the unread count current and pops a toast when something arrives, using a server-sent-events
 * connection that is opened with a short-lived ticket (EventSource cannot send an Authorization header).
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const listeners = useRef(new Set<(n: Notification) => void>());
  const onNotification = useCallback((fn: (n: Notification) => void) => { listeners.current.add(fn); return () => { listeners.current.delete(fn); }; }, []);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let stopped = false;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retry = 0;

    api.get<{ count: number }>('/api/notifications/unread-count').then((r) => { if (!stopped) setUnread(r.count); }).catch(() => undefined);

    const connect = async () => {
      try {
        const { ticket } = await api.post<{ ticket: string }>('/api/stream/ticket');
        if (stopped) return;
        source = new EventSource(`${api.baseApiUrl}/api/stream?ticket=${ticket}`);
        source.addEventListener('ready', () => { retry = 0; });
        source.addEventListener('notification', (e) => {
          const n = JSON.parse((e as MessageEvent).data) as Notification;
          setUnread((c) => c + 1);
          toast.info(n.title, n.link ?? undefined);
          listeners.current.forEach((fn) => fn(n));
        });
        source.onerror = () => { source?.close(); schedule(); };
      } catch {
        schedule();
      }
    };
    const schedule = () => { if (!stopped) timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++)); };
    void connect();
    return () => { stopped = true; clearTimeout(timer); source?.close(); };
  }, [user]);

  return <LiveContext.Provider value={{ unread, setUnread, onNotification }}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);

/** Watch a thread for new comments. No sign-in needed, and no private data comes over this channel. */
export function useThreadLive(postId: string | undefined, onComment: (c: { id: string; parentCommentId: string | null; author: string }) => void) {
  const handler = useRef(onComment);
  handler.current = onComment;
  useEffect(() => {
    if (!postId) return;
    const source = new EventSource(`${api.baseApiUrl}/api/stream?channels=post:${postId}`);
    source.addEventListener('comment', (e) => handler.current(JSON.parse((e as MessageEvent).data)));
    return () => source.close();
  }, [postId]);
}
