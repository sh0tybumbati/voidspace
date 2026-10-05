import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { badRequest, handler, notFound } from '../lib/http';
import { removeContent, requireModerator } from '../services/moderation';
import { notify } from '../services/notify';

const router = Router();

async function spaceByName(name: string) {
  const space = await prisma.space.findUnique({ where: { name: name.toLowerCase() } });
  if (!space) throw notFound('Space not found.');
  return space;
}

/**
 * GET /api/mod/spaces/:name/reports?status=pending|resolved
 * The mod queue: reported posts and comments, grouped by what was reported.
 */
router.get('/spaces/:name/reports', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const space = await spaceByName(req.params.name);
  await requireModerator(req.userId!, space.id);
  const status = req.query.status === 'resolved' ? 'resolved' : 'pending';

  const reports = await prisma.report.findMany({
    where: { spaceId: space.id, status, targetType: { in: ['post', 'comment'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { reporter: { select: { username: true } } },
  });

  const groups = new Map<string, { targetType: string; targetId: string; reports: typeof reports }>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId}`;
    if (!groups.has(key)) groups.set(key, { targetType: r.targetType, targetId: r.targetId, reports: [] });
    groups.get(key)!.reports.push(r);
  }

  const postIds = [...groups.values()].filter((g) => g.targetType === 'post').map((g) => g.targetId);
  const commentIds = [...groups.values()].filter((g) => g.targetType === 'comment').map((g) => g.targetId);
  const [posts, comments] = await Promise.all([
    prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, content: true, url: true, removed: true, createdAt: true, author: { select: { username: true } } } }),
    prisma.comment.findMany({ where: { id: { in: commentIds } }, select: { id: true, content: true, removed: true, createdAt: true, postId: true, author: { select: { username: true } } } }),
  ]);
  const byId = new Map<string, any>([...posts, ...comments].map((t) => [t.id, t]));

  res.json({
    items: [...groups.values()].map((g) => ({
      targetType: g.targetType,
      targetId: g.targetId,
      target: byId.get(g.targetId) ?? null,
      count: g.reports.length,
      categories: [...new Set(g.reports.map((r) => r.category))],
      latestAt: g.reports[0].createdAt,
      resolution: g.reports[0].resolution,
      reports: g.reports.map((r) => ({ id: r.id, category: r.category, reason: r.reason, reporter: r.reporter.username, createdAt: r.createdAt })),
    })),
  });
}));

const resolveSchema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().uuid(),
  action: z.enum(['remove', 'dismiss']),
  reason: z.string().trim().optional(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/mod/reports/resolve
 * Resolve every pending report about one post or comment: remove it (with a public reason) or dismiss the reports.
 */
router.post('/reports/resolve', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = resolveSchema.parse(req.body);
  const pending = await prisma.report.findMany({ where: { targetId: body.targetId, targetType: body.targetType, status: 'pending' } });
  if (!pending.length) throw notFound('There are no open reports for that.');
  const spaceId = pending[0].spaceId!;
  await requireModerator(req.userId!, spaceId);

  if (body.action === 'remove') {
    if (!body.reason || body.reason.length < 10) throw badRequest('Removal reason must be at least 10 characters');
    await removeContent(req.userId!, body.targetType, body.targetId, body.reason);
  }
  await prisma.report.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { status: 'resolved', resolution: body.action === 'remove' ? 'removed' : 'dismissed', resolutionNote: body.note ?? body.reason ?? null, reviewedBy: req.userId!, resolvedAt: new Date() },
  });
  await notify([...new Set(pending.map((r) => r.reporterId))], {
    type: 'report_resolved',
    title: body.action === 'remove' ? 'Moderators removed what you reported' : 'Moderators reviewed your report',
    body: body.action === 'remove' ? 'Thank you for helping keep the space healthy.' : 'They decided no action was needed.',
  });
  res.json({ message: 'Reports resolved', resolved: pending.length, action: body.action });
}));

/**
 * GET /api/mod/spaces/:name/appeals?status=pending|resolved|escalated
 * Appeals against this space's moderation, for moderators. `canReview` is false for appeals about your own actions.
 */
router.get('/spaces/:name/appeals', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const space = await spaceByName(req.params.name);
  await requireModerator(req.userId!, space.id);
  const status = String(req.query.status ?? 'pending');
  const where = status === 'resolved' ? { spaceId: space.id, status: { in: ['approved', 'denied'] } } : { spaceId: space.id, status };
  const appeals = await prisma.appeal.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 100,
    include: { user: { select: { username: true } }, modAction: { include: { mod: { select: { username: true } } } }, reviewer: { select: { username: true } } },
  });
  res.json({
    appeals: appeals.map((a) => ({
      id: a.id, status: a.status, reason: a.reason, createdAt: a.createdAt, resolvedAt: a.resolvedAt, reviewerNotes: a.reviewerNotes,
      appellant: a.user.username, reviewer: a.reviewer?.username ?? null,
      action: { id: a.modAction.id, type: a.modAction.actionType, reason: a.modAction.reason, targetType: a.modAction.targetType, targetId: a.modAction.targetId, by: a.modAction.mod.username, at: a.modAction.createdAt },
      canReview: a.status === 'pending' && a.modAction.modId !== req.userId,
    })),
  });
}));

export default router;
