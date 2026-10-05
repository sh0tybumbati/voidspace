import { EventEmitter } from 'node:events';

/** In-process event bus. Live updates (notifications, new comments) go through here to the stream. */
export interface BusEvent {
  channel: string; // 'user:<id>' for private events, 'post:<id>' for public thread events
  type: string;
  data: unknown;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function publish(channel: string, type: string, data: unknown): void {
  emitter.emit('event', { channel, type, data } satisfies BusEvent);
}

export function subscribe(listener: (e: BusEvent) => void): () => void {
  emitter.on('event', listener);
  return () => emitter.off('event', listener);
}
