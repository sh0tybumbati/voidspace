import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { adminMiddleware, authMiddleware, AuthRequest } from '../middleware/auth';
import { badRequest, conflict, forbidden, handler, notFound } from '../lib/http';
import { APPEAL_WINDOW_DAYS, markReversed, requireModerator, restoreContent, unbanUser } from '../services/moderation';
import { logAdminAction } from '../services/admin';
import { notify, notifyAdmins, notifyModerators } from '../services/notify';

const router = Router();
const APPEALABLE = ['remove_post', 'remove_comment', 'ban_user'];

/** Who was affected by a moderation action: the content's author, or the banned user. */
async function affectedUserId(action: { actionType: string; targetId: string }): Promise<string | null> {
  if (action.actionType === 'remove_post') return (await prisma.post.findUnique({ where: { id: action.targetId } }))?.authorId ?? null;
  if (action.actionType === 'remove_comment') return (await prisma.comment.findUnique({ where: { id: action.targetId } }))?.authorId ?? null;
  if (action.actionType === 'ban_user') return action.targetId;
  return null;
}

/** Undo the moderation action an appeal was about. */
async function reverse(action: { id: string; actionType: string; targetId: string; spaceId: string }, actorId: string, reason: string, opts: { skipAuth: boolean }) {
  if (action.actionType === 'remove_post') await restoreContent(actorId, 'post', action.targetId, reason, opts);
  else if (action.actionType === 'remove_comment') await restoreContent(actorId, 'comment', action.targetId, reason, opts);
  else if (action.actionType === 'ban_user') await unbanUser(actorId, action.spaceId, action.targetId, reason, opts).catch((e) => { if (e.status !== 404) throw e; });
  await markReversed(action.id, actorId);
}

const createSchema = z.object({ modActionId: z.string().uuid(), reason: z.string().trim().min(20, 'Please explain your appeal in at least 20 characters.').max(3000) });

/**
 * POST /api/appeals
 * Appeal a removal or ban within 30 days. A different moderator reviews it; if the space has no other
 * moderator it goes straight to the site admins.
 */
router.post('/', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { modActionId, reason } = createSchema.parse(req.body);
  const action = await prisma.modAction.findUnique({ where: { id: modActionId }, include: { space: true } });
  if (!action) throw notFound('Moderation action not found.');
  if (!APPEALABLE.includes(action.actionType)) throw badRequest('That action cannot be appealed.');
  if ((await affectedUserId(action)) !== req.userId) throw forbidden('You can only appeal actions taken against you.');
  if (action.reversedAt) throw conflict('That action has already been reversed.');
  if (Date.now() - action.createdAt.getTime() > APPEAL_WINDOW_DAYS * 86_400_000) throw badRequest(`Appeals must be made within ${APPEAL_WINDOW_DAYS} days.`);
  if (await prisma.appeal.findFirst({ where: { modActionId } })) throw conflict('That action has already been appealed.');

  const others = await prisma.moderator.count({ where: { spaceId: action.spaceId, userId: { not: action.modId } } });
  const escalated = others === 0;
  const appeal = await prisma.appeal.create({
    data: { userId: req.userId!, spaceId: action.spaceId, modActionId, reason, status: escalated ? 'escalated' : 'pending', escalatedAt: escalated ? new Date() : null },
  });

  if (escalated) {
    await notifyAdmins({ type: 'appeal_escalated', title: `Appeal needs an admin (v/${action.space.name})`, body: 'The space has no other moderator to review it.', link: '/admin/appeals' });
  } else {
    await notifyModerators(action.spaceId, { type: 'appeal_filed', title: `New appeal in v/${action.space.name}`, link: `/v/${action.space.name}/mod/appeals` }, action.modId);
  }
  res.status(201).json({ message: 'Your appeal was sent.', appeal: { id: appeal.id, status: appeal.status } });
}));

/** GET /api/appeals/mine */
router.get('/mine', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const appeals = await prisma.appeal.findMany({
    where: { userId: req.userId! }, orderBy: { createdAt: 'desc' }, take: 50,
    include: { space: { select: { name: true } }, modAction: { select: { actionType: true, reason: true, createdAt: true } } },
  });
  res.json({ appeals: appeals.map((a) => ({ id: a.id, status: a.status, reason: a.reason, reviewerNotes: a.reviewerNotes, createdAt: a.createdAt, resolvedAt: a.resolvedAt, space: a.space.name, action: a.modAction })) });
}));

const reviewSchema = z.object({ decision: z.enum(['approve', 'deny', 'escalate']), notes: z.string().trim().max(2000).optional() });

/**
 * POST /api/appeals/:id/review
 * A moderator other than the one who took the action approves (and the action is reversed), denies (with an
 * explanation) or escalates the appeal to the site admins.
 */
router.post('/:id/review', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { decision, notes } = reviewSchema.parse(req.body);
  const appeal = await prisma.appeal.findUnique({ where: { id: req.params.id }, include: { modAction: true, space: true } });
  if (!appeal) throw notFound('Appeal not found.');
  await requireModerator(req.userId!, appeal.spaceId);
  if (appeal.modAction.modId === req.userId) throw forbidden('The moderator who took the action cannot review its appeal.');
  if (appeal.status !== 'pending') throw conflict('That appeal has already been handled.');
  if (decision === 'deny' && (!notes || notes.length < 10)) throw badRequest('Please explain the decision (at least 10 characters).');

  const now = new Date();
  if (decision === 'escalate') {
    await prisma.appeal.update({ where: { id: appeal.id }, data: { status: 'escalated', escalatedAt: now, reviewedBy: req.userId!, reviewerNotes: notes ?? null } });
    await notifyAdmins({ type: 'appeal_escalated', title: `Appeal escalated (v/${appeal.space.name})`, body: notes, link: '/admin/appeals' });
    await notify(appeal.userId, { type: 'appeal_update', title: 'Your appeal was sent to the site admins', body: notes });
  } else {
    if (decision === 'approve') await reverse(appeal.modAction, req.userId!, notes || 'Appeal approved', { skipAuth: true });
    await prisma.appeal.update({ where: { id: appeal.id }, data: { status: decision === 'approve' ? 'approved' : 'denied', reviewedBy: req.userId!, reviewerNotes: notes ?? null, resolvedAt: now } });
    await notify(appeal.userId, {
      type: 'appeal_update',
      title: decision === 'approve' ? 'Your appeal was approved' : 'Your appeal was denied',
      body: notes,
      link: decision === 'approve' ? `/v/${appeal.space.name}` : undefined,
    });
  }
  res.json({ message: 'Appeal updated', status: decision === 'approve' ? 'approved' : decision === 'deny' ? 'denied' : 'escalated' });
}));

// ---------------------------------------------------------------------------------------------
// Site admins handle escalated appeals. The decision and its justification are public.
// ---------------------------------------------------------------------------------------------

/** GET /api/appeals/admin/escalated */
router.get('/admin/escalated', adminMiddleware, handler<AuthRequest>(async (_req, res) => {
  const appeals = await prisma.appeal.findMany({
    where: { status: 'escalated' }, orderBy: { escalatedAt: 'asc' }, take: 100,
    include: { user: { select: { username: true } }, space: { select: { name: true } }, modAction: { include: { mod: { select: { username: true } } } } },
  });
  res.json({ appeals: appeals.map((a) => ({ id: a.id, reason: a.reason, reviewerNotes: a.reviewerNotes, space: a.space.name, appellant: a.user.username, escalatedAt: a.escalatedAt, action: { type: a.modAction.actionType, reason: a.modAction.reason, by: a.modAction.mod.username } })) });
}));

const adminResolveSchema = z.object({ decision: z.enum(['approve', 'deny']), justification: z.string().trim().min(20, 'A public justification of at least 20 characters is required.').max(3000) });

/** POST /api/appeals/admin/:id/resolve */
router.post('/admin/:id/resolve', adminMiddleware, handler<AuthRequest>(async (req, res) => {
  const { decision, justification } = adminResolveSchema.parse(req.body);
  const appeal = await prisma.appeal.findUnique({ where: { id: req.params.id }, include: { modAction: true, space: true } });
  if (!appeal) throw notFound('Appeal not found.');
  if (appeal.status !== 'escalated') throw conflict('That appeal is not waiting for an admin.');

  if (decision === 'approve') await reverse(appeal.modAction, req.userId!, `Site admin decision: ${justification}`, { skipAuth: true });
  await prisma.appeal.update({ where: { id: appeal.id }, data: { status: decision === 'approve' ? 'approved' : 'denied', reviewedBy: req.userId!, reviewerNotes: justification, resolvedAt: new Date() } });
  await logAdminAction(req.userId!, decision === 'approve' ? 'appeal_approved' : 'appeal_denied', appeal.id, 'appeal', justification);
  await notify(appeal.userId, { type: 'appeal_update', title: decision === 'approve' ? 'Your appeal was approved by a site admin' : 'Your appeal was denied by a site admin', body: justification, link: '/transparency' });
  await notifyModerators(appeal.spaceId, { type: 'appeal_update', title: `A site admin ${decision === 'approve' ? 'approved' : 'denied'} an escalated appeal`, body: justification });
  res.json({ message: 'Appeal resolved', status: decision === 'approve' ? 'approved' : 'denied' });
}));

export default router;
