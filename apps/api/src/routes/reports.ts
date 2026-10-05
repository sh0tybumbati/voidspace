import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { HttpError, badRequest, conflict, handler, notFound } from '../lib/http';
import { notifyAdmins, notifyModerators } from '../services/notify';

export const REPORT_CATEGORIES = ['spam', 'harassment', 'hate', 'nsfw_unmarked', 'illegal', 'other'] as const;
const MAX_REPORTS_PER_HOUR = 20;

const router = Router();

const createSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string().uuid(),
  category: z.enum(REPORT_CATEGORIES),
  reason: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/reports
 * Report a post, comment or user. Posts and comments go to the space's moderators; users, and anything
 * reported as illegal, also go to the site admins.
 */
router.post('/', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = createSchema.parse(req.body);
  const reporterId = req.userId!;

  const recent = await prisma.report.count({ where: { reporterId, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
  if (recent >= MAX_REPORTS_PER_HOUR) throw new HttpError(429, 'You have sent a lot of reports in the last hour. Try again later.');

  let spaceId: string | null = null;
  let spaceName = '';
  let authorId: string;
  if (body.targetType === 'post') {
    const post = await prisma.post.findUnique({ where: { id: body.targetId }, include: { space: true } });
    if (!post) throw notFound('Post not found.');
    spaceId = post.spaceId; spaceName = post.space.name; authorId = post.authorId;
  } else if (body.targetType === 'comment') {
    const comment = await prisma.comment.findUnique({ where: { id: body.targetId }, include: { post: { include: { space: true } } } });
    if (!comment) throw notFound('Comment not found.');
    spaceId = comment.post.spaceId; spaceName = comment.post.space.name; authorId = comment.authorId;
  } else {
    const user = await prisma.user.findUnique({ where: { id: body.targetId } });
    if (!user) throw notFound('User not found.');
    authorId = user.id;
  }
  if (authorId === reporterId) throw badRequest('You cannot report your own content.');

  const existing = await prisma.report.findUnique({ where: { reporterId_targetId_targetType: { reporterId, targetId: body.targetId, targetType: body.targetType } } });
  if (existing) throw conflict('You have already reported this.');

  const firstForTarget = (await prisma.report.count({ where: { targetId: body.targetId, targetType: body.targetType, status: 'pending' } })) === 0;
  const report = await prisma.report.create({
    data: { reporterId, targetId: body.targetId, targetType: body.targetType, category: body.category, reason: body.reason || body.category, spaceId },
  });

  const siteLevel = body.targetType === 'user' || body.category === 'illegal';
  if (spaceId && firstForTarget) {
    await notifyModerators(spaceId, { type: 'report_filed', title: `New report in v/${spaceName}`, body: `A ${body.targetType} was reported for ${body.category.replace('_', ' ')}.`, link: `/v/${spaceName}/mod/reports` }, authorId);
  }
  if (siteLevel) {
    await notifyAdmins({ type: 'report_filed', title: body.category === 'illegal' ? 'Content reported as illegal' : 'A user was reported', link: '/admin/reports' });
  }
  res.status(201).json({ message: 'Thanks. Your report was sent.', report: { id: report.id, status: report.status } });
}));

/** GET /api/reports/mine: what you have reported and what came of it */
router.get('/mine', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const reports = await prisma.report.findMany({
    where: { reporterId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, targetType: true, targetId: true, category: true, status: true, resolution: true, createdAt: true, resolvedAt: true },
  });
  res.json({ reports });
}));

export default router;
