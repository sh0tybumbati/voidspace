import { Router } from 'express';
import { prisma } from '../db';
import { handler } from '../lib/http';

const router = Router();
const pageParams = (q: Record<string, unknown>) => {
  const page = Math.max(1, parseInt(String(q.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(q.limit ?? '25'), 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
};

export async function canaryStatus(now = new Date()) {
  const latest = await prisma.transparencyCanary.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!latest) return { status: 'none' as const, statement: null, validUntil: null, signedAt: null, daysLeft: null };
  const daysLeft = Math.ceil((latest.validUntil.getTime() - now.getTime()) / 86_400_000);
  return { status: latest.validUntil > now ? ('valid' as const) : ('expired' as const), statement: latest.statement, validUntil: latest.validUntil, signedAt: latest.createdAt, daysLeft };
}

/** GET /api/transparency/summary: the numbers, and the canary, on one page */
router.get('/summary', handler(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [modActions, adminActions, notices, appeals, activeElections, activeVotes, spaces, canary] = await Promise.all([
    prisma.modAction.count({ where: { createdAt: { gt: since } } }),
    prisma.adminAction.count({ where: { createdAt: { gt: since } } }),
    prisma.legalNotice.count(),
    prisma.appeal.groupBy({ by: ['status'], _count: true }),
    prisma.modElection.count({ where: { status: 'active' } }),
    prisma.communityVote.count({ where: { status: 'active' } }),
    prisma.space.count({ where: { deletedAt: null } }),
    canaryStatus(),
  ]);
  res.json({
    last30Days: { modActions, adminActions },
    legalNotices: notices,
    appeals: Object.fromEntries(appeals.map((a) => [a.status, a._count])),
    governance: { activeElections, activeVotes },
    spaces,
    canary,
  });
}));

/** GET /api/transparency/admin-actions: every action by a site admin, with its justification, in public */
router.get('/admin-actions', handler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const [rows, total] = await Promise.all([
    prisma.adminAction.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit, include: { admin: { select: { username: true } } } }),
    prisma.adminAction.count(),
  ]);
  res.json({
    actions: rows.map((a) => ({ id: a.id, admin: a.admin.username, actionType: a.actionType, targetType: a.targetType, targetId: a.targetId, justification: a.justification, evidence: a.evidence, createdAt: a.createdAt })),
    pagination: { page, limit, totalCount: total, totalPages: Math.ceil(total / limit) },
  });
}));

/** GET /api/transparency/legal-notices: takedown requests and orders, and what was done about each */
router.get('/legal-notices', handler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const [notices, total] = await Promise.all([
    prisma.legalNotice.findMany({ orderBy: { dateReceived: 'desc' }, skip, take: limit }),
    prisma.legalNotice.count(),
  ]);
  res.json({ notices, pagination: { page, limit, totalCount: total, totalPages: Math.ceil(total / limit) } });
}));

/** GET /api/transparency/canary */
router.get('/canary', handler(async (_req, res) => { res.json(await canaryStatus()); }));

/** GET /api/transparency/mod-actions: recent moderator actions across every space */
router.get('/mod-actions', handler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const rows = await prisma.modAction.findMany({
    orderBy: { createdAt: 'desc' }, skip, take: limit,
    include: { mod: { select: { username: true } }, space: { select: { name: true } } },
  });
  res.json({ actions: rows.map((a) => ({ id: a.id, space: a.space.name, moderator: a.mod.username, actionType: a.actionType, targetType: a.targetType, reason: a.reason, createdAt: a.createdAt, reversedAt: a.reversedAt })) });
}));

export default router;
