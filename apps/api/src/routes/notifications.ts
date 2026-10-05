import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { handler } from '../lib/http';

const router = Router();

/** GET /api/notifications?unread=1&limit=30&before=<iso date> */
router.get('/', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;
  const where = {
    userId: req.userId!,
    ...(req.query.unread === '1' ? { readAt: null } : {}),
    ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
  };
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.notification.count({ where: { userId: req.userId!, readAt: null } }),
  ]);
  res.json({ notifications, unreadCount });
}));

router.get('/unread-count', authMiddleware, handler<AuthRequest>(async (req, res) => {
  res.json({ count: await prisma.notification.count({ where: { userId: req.userId!, readAt: null } }) });
}));

const readSchema = z.object({ ids: z.array(z.string().uuid()).max(200).optional(), all: z.boolean().optional() })
  .refine((b) => b.all || (b.ids && b.ids.length), { message: 'Give ids, or all: true.' });

/** POST /api/notifications/read: mark some, or all, as read */
router.post('/read', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = readSchema.parse(req.body);
  const result = await prisma.notification.updateMany({
    where: { userId: req.userId!, readAt: null, ...(body.all ? {} : { id: { in: body.ids } }) },
    data: { readAt: new Date() },
  });
  res.json({ marked: result.count });
}));

export default router;
