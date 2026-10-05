import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { subscribe } from '../lib/bus';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { HttpError, handler } from '../lib/http';

const router = Router();

// EventSource cannot send an Authorization header, so a signed-in client first trades its token for a
// one-minute, single-use ticket and connects with that. The token itself never appears in a URL.
const tickets = new Map<string, { userId: string; expires: number }>();
const openByUser = new Map<string, number>();
const MAX_STREAMS_PER_USER = 5;
const MAX_STREAMS_TOTAL = 2000;
let openTotal = 0;
const POST_CHANNEL = /^post:[0-9a-f-]{36}$/;

setInterval(() => { const now = Date.now(); for (const [t, v] of tickets) if (v.expires < now) tickets.delete(t); }, 30_000).unref();

/** POST /api/stream/ticket */
router.post('/ticket', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const ticket = randomBytes(24).toString('hex');
  tickets.set(ticket, { userId: req.userId!, expires: Date.now() + 60_000 });
  res.json({ ticket, expiresIn: 60 });
}));

/**
 * GET /api/stream?ticket=...&channels=post:<id>,post:<id>
 * Server-sent events. With a ticket you receive your own notifications; with channels you receive public
 * events for those threads (new comments). Anonymous visitors can watch threads.
 */
router.get('/', (req, res, next) => {
  try {
    let userId: string | undefined;
    if (req.query.ticket) {
      const t = tickets.get(String(req.query.ticket));
      tickets.delete(String(req.query.ticket)); // single use
      if (!t || t.expires < Date.now()) throw new HttpError(401, 'That stream ticket is not valid. Ask for a new one.');
      userId = t.userId;
    }
    const channels = new Set(String(req.query.channels ?? '').split(',').map((c) => c.trim()).filter(Boolean));
    if (channels.size > 10) throw new HttpError(400, 'Too many channels (10 at most).');
    for (const c of channels) if (!POST_CHANNEL.test(c)) throw new HttpError(400, `Unknown channel: ${c.slice(0, 40)}`);
    if (!userId && !channels.size) throw new HttpError(400, 'Choose a ticket or at least one channel.');
    if (openTotal >= MAX_STREAMS_TOTAL) throw new HttpError(429, 'The live feed is busy. Try again shortly.');
    if (userId && (openByUser.get(userId) ?? 0) >= MAX_STREAMS_PER_USER) throw new HttpError(429, 'Too many open live connections for this account.');

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    res.write(`event: ready\ndata: ${JSON.stringify({ user: Boolean(userId), channels: [...channels] })}\n\n`);

    openTotal++;
    if (userId) openByUser.set(userId, (openByUser.get(userId) ?? 0) + 1);
    const unsubscribe = subscribe((e) => {
      if (e.channel === `user:${userId}` || channels.has(e.channel)) res.write(`event: ${e.type}\ndata: ${JSON.stringify({ channel: e.channel, ...(e.data as object) })}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat); unsubscribe(); openTotal--;
      if (userId) openByUser.set(userId, Math.max(0, (openByUser.get(userId) ?? 1) - 1));
    });
  } catch (err) {
    next(err);
  }
});

export default router;
