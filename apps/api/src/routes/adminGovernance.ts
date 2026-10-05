import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { adminMiddleware, AuthRequest } from '../middleware/auth';
import { badRequest, handler, notFound } from '../lib/http';
import { adminRemoveContent, logAdminAction } from '../services/admin';
import { notify } from '../services/notify';

const router = Router();
const justification = z.string().trim().min(20, 'A public justification of at least 20 characters is required.').max(3000);

/**
 * PATCH /api/admin/users/:userId
 * Promote, demote, ban or unban an account. Needs a justification, which is published.
 */
router.patch('/users/:userId', adminMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = z.object({ isAdmin: z.boolean().optional(), banned: z.boolean().optional(), justification })
    .refine((b) => b.isAdmin !== undefined || b.banned !== undefined, { message: 'Say what to change (isAdmin or banned).' })
    .parse(req.body);
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target) throw notFound('User not found.');
  if (target.id === req.userId && (body.banned === true || body.isAdmin === false)) throw badRequest('You cannot ban or demote yourself.');

  const data: { isAdmin?: boolean; banned?: boolean } = {};
  if (body.isAdmin !== undefined) data.isAdmin = body.isAdmin;
  if (body.banned !== undefined) data.banned = body.banned;
  const user = await prisma.user.update({ where: { id: target.id }, data, select: { id: true, username: true, isAdmin: true, banned: true } });

  if (body.banned !== undefined && body.banned !== target.banned) await logAdminAction(req.userId!, body.banned ? 'ban_user' : 'unban_user', target.id, 'user', body.justification);
  if (body.isAdmin !== undefined && body.isAdmin !== target.isAdmin) await logAdminAction(req.userId!, body.isAdmin ? 'grant_admin' : 'revoke_admin', target.id, 'user', body.justification);
  res.json({ message: 'User updated successfully', user });
}));

/** POST /api/admin/remove-content: take down a post or comment site-wide (for example something illegal) */
router.post('/remove-content', adminMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = z.object({ targetType: z.enum(['post', 'comment']), targetId: z.string().uuid(), justification }).parse(req.body);
  const action = await adminRemoveContent(req.userId!, body.targetType, body.targetId, body.justification);
  res.json({ message: 'Removed', actionId: action.id });
}));

/**
 * GET /api/admin/reports
 * Site-level reports: accounts, and anything reported as illegal.
 */
router.get('/reports', adminMiddleware, handler<AuthRequest>(async (req, res) => {
  const status = req.query.status === 'resolved' ? 'resolved' : 'pending';
  const reports = await prisma.report.findMany({
    where: { status, OR: [{ targetType: 'user' }, { category: 'illegal' }] },
    orderBy: { createdAt: 'desc' }, take: 200,
    include: { reporter: { select: { username: true } }, space: { select: { name: true } } },
  });
  res.json({ reports: reports.map((r) => ({ id: r.id, targetType: r.targetType, targetId: r.targetId, category: r.category, reason: r.reason, status: r.status, resolution: r.resolution, reporter: r.reporter.username, space: r.space?.name ?? null, createdAt: r.createdAt })) });
}));

/** POST /api/admin/reports/resolve: remove, ban or dismiss, with a public justification */
router.post('/reports/resolve', adminMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = z.object({ targetType: z.enum(['post', 'comment', 'user']), targetId: z.string().uuid(), action: z.enum(['remove', 'ban', 'dismiss']), justification }).parse(req.body);
  const open = await prisma.report.findMany({ where: { targetId: body.targetId, targetType: body.targetType, status: 'pending' } });
  if (!open.length) throw notFound('There are no open reports for that.');

  if (body.action === 'remove') {
    if (body.targetType === 'user') throw badRequest('Use "ban" for accounts.');
    await adminRemoveContent(req.userId!, body.targetType, body.targetId, body.justification);
  } else if (body.action === 'ban') {
    if (body.targetType !== 'user') throw badRequest('Only accounts can be banned. Remove the content instead.');
    if (body.targetId === req.userId) throw badRequest('You cannot ban yourself.');
    await prisma.user.update({ where: { id: body.targetId }, data: { banned: true } });
    await logAdminAction(req.userId!, 'ban_user', body.targetId, 'user', body.justification);
  } else {
    await logAdminAction(req.userId!, 'dismiss_report', body.targetId, body.targetType, body.justification);
  }
  await prisma.report.updateMany({ where: { id: { in: open.map((r) => r.id) } }, data: { status: 'resolved', resolution: body.action === 'dismiss' ? 'dismissed' : body.action === 'ban' ? 'banned' : 'removed', resolutionNote: body.justification, reviewedBy: req.userId!, resolvedAt: new Date() } });
  await notify([...new Set(open.map((r) => r.reporterId))], { type: 'report_resolved', title: body.action === 'dismiss' ? 'Site admins reviewed your report' : 'Site admins acted on your report', link: '/transparency' });
  res.json({ message: 'Reports resolved', resolved: open.length });
}));

const noticeSchema = z.object({
  noticeType: z.enum(['dmca', 'court_order', 'government_request', 'other']),
  jurisdiction: z.string().trim().min(2).max(100),
  dateReceived: z.coerce.date(),
  actionTaken: z.string().trim().min(10).max(2000),
  publicSummary: z.string().trim().max(3000).optional(),
  affectedContentType: z.enum(['post', 'comment', 'user', 'space']).optional(),
  affectedContentId: z.string().uuid().optional(),
});

/** POST /api/admin/legal-notices: record a legal request and what was done. Published. */
router.post('/legal-notices', adminMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = noticeSchema.parse(req.body);
  const notice = await prisma.legalNotice.create({ data: body });
  await logAdminAction(req.userId!, 'publish_legal_notice', notice.id, 'legal_notice', `${body.noticeType} from ${body.jurisdiction}: ${body.actionTaken}`);
  res.status(201).json({ message: 'Published', notice });
}));

/** POST /api/admin/canary: sign a new transparency canary statement */
router.post('/canary', adminMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = z.object({ statement: z.string().trim().min(20).max(3000), validUntil: z.coerce.date() }).parse(req.body);
  if (body.validUntil.getTime() <= Date.now()) throw badRequest('The canary must be valid until a future date.');
  if (body.validUntil.getTime() > Date.now() + 400 * 86_400_000) throw badRequest('A canary should be renewed within a year.');
  const canary = await prisma.transparencyCanary.create({ data: body });
  await logAdminAction(req.userId!, 'sign_canary', canary.id, 'canary', 'Signed a new transparency canary statement.');
  res.status(201).json({ message: 'Canary signed', canary });
}));

export default router;
