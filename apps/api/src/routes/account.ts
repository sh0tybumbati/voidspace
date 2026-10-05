import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { HttpError, handler } from '../lib/http';
import { deleteAccount, deletionCheck } from '../services/accountDeletion';

const router = Router();
const CAP = 20_000;   // a sane ceiling per list, so one export cannot hold the server for minutes

/** GET /api/account/deletion-check: what deleting would do, and anything standing in the way */
router.get('/deletion-check', authMiddleware, handler<AuthRequest>(async (req, res) => {
  res.json(await deletionCheck(req.userId!));
}));

/**
 * POST /api/account/delete
 * Needs the password again, so a stolen session cannot erase an account. `deleteContent` also blanks the
 * person's posts and comments and removes their uploaded images; without it they stay, shown as "[deleted]".
 */
router.post('/delete', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const body = z.object({ password: z.string().min(1).max(200), deleteContent: z.boolean().default(false) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(403, 'That password is not right.', 'wrong_password');
  await deleteAccount(req.userId!, { deleteContent: body.deleteContent });
  res.json({ message: 'Your account was deleted.' });
}));

/**
 * GET /api/account/export
 * Everything the site holds about the caller, as one JSON file.
 */
router.get('/export', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const id = req.userId!;
  const take = CAP;
  const [user, posts, comments, votes, savedPosts, savedComments, subscriptions, moderatorRoles, modActions, reports, appeals, notifications, uploads, electionVotes, communityBallots, elections, proposals] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id }, select: { username: true, email: true, bio: true, avatarUrl: true, preferences: true, alignment: true, isOver18: true, emailVerifiedAt: true, createdAt: true } }),
    prisma.post.findMany({ where: { authorId: id }, take, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, content: true, postType: true, url: true, voteScore: true, commentCount: true, isNsfw: true, removed: true, removalReason: true, createdAt: true, editedAt: true, space: { select: { name: true } } } }),
    prisma.comment.findMany({ where: { authorId: id }, take, orderBy: { createdAt: 'desc' }, select: { id: true, postId: true, content: true, imageUrl: true, voteScore: true, removed: true, removalReason: true, createdAt: true, editedAt: true } }),
    prisma.vote.findMany({ where: { userId: id }, take, select: { targetType: true, targetId: true, voteValue: true, createdAt: true } }),
    prisma.savedPost.findMany({ where: { userId: id }, take, select: { postId: true, createdAt: true } }),
    prisma.savedComment.findMany({ where: { userId: id }, take, select: { commentId: true, createdAt: true } }),
    prisma.subscription.findMany({ where: { userId: id }, select: { createdAt: true, space: { select: { name: true } } } }),
    prisma.moderator.findMany({ where: { userId: id }, select: { isFounder: true, addedAt: true, permissions: true, space: { select: { name: true } } } }),
    prisma.modAction.findMany({ where: { modId: id }, take, orderBy: { createdAt: 'desc' }, select: { actionType: true, targetType: true, targetId: true, reason: true, createdAt: true, reversedAt: true, space: { select: { name: true } } } }),
    prisma.report.findMany({ where: { reporterId: id }, take, select: { targetType: true, targetId: true, category: true, reason: true, status: true, resolution: true, createdAt: true } }),
    prisma.appeal.findMany({ where: { userId: id }, take, select: { reason: true, status: true, reviewerNotes: true, createdAt: true, resolvedAt: true, space: { select: { name: true } } } }),
    prisma.notification.findMany({ where: { userId: id }, take, orderBy: { createdAt: 'desc' }, select: { type: true, title: true, body: true, link: true, readAt: true, createdAt: true } }),
    prisma.upload.findMany({ where: { userId: id }, take, select: { url: true, mime: true, bytes: true, width: true, height: true, createdAt: true } }),
    prisma.electionVote.findMany({ where: { userId: id }, take, select: { vote: true, election: { select: { electionType: true, candidate: { select: { username: true } }, space: { select: { name: true } } } } } }),
    prisma.communityBallot.findMany({ where: { userId: id }, take, select: { vote: true, voteRef: { select: { title: true, voteType: true, space: { select: { name: true } } } } } }),
    prisma.modElection.findMany({ where: { OR: [{ candidateId: id }, { nominatorId: id }] }, take, select: { electionType: true, status: true, electionStart: true, electionEnd: true, votesFor: true, votesAgainst: true, candidate: { select: { username: true } }, space: { select: { name: true } } } }),
    prisma.communityVote.findMany({ where: { proposerId: id }, take, select: { voteType: true, title: true, proposal: true, status: true, createdAt: true, space: { select: { name: true } } } }),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    note: 'Everything Voidspace holds about this account. Lists are capped at 20,000 entries each. Other people\'s content is not included.',
    account: user, posts, comments, votesCast: votes, savedPosts, savedComments, subscriptions, moderatorRoles,
    moderationActionsTaken: modActions, reportsFiled: reports, appeals, notifications, uploads,
    electionBallots: electionVotes, communityBallots, electionsInvolved: elections, communityVotesProposed: proposals,
  };
  res.setHeader('Content-Disposition', `attachment; filename="voidspace-${user.username}-export.json"`);
  res.type('application/json').send(JSON.stringify(body, null, 2));
}));

export default router;
