import { Router, Response } from 'express';
import { z } from 'zod';
import { hasModPermission } from '../utils/permissions';
import { handler, notFound } from '../lib/http';
import { banUser, removeContent, restoreContent, unbanUser } from '../services/moderation';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

/**
 * Helper: Check if user is a moderator of a space
 */
async function checkModeratorPermission(
  userId: string,
  spaceId: string,
  requiredPermission?: string
): Promise<{ isMod: boolean; moderator?: any }> {
  const moderator = await prisma.moderator.findUnique({
    where: {
      userId_spaceId: {
        userId,
        spaceId,
      },
    },
  });

  if (!moderator) {
    return { isMod: false };
  }

  // Check if moderator has the required permission
  if (requiredPermission) {
    const hasPermission =
      hasModPermission(moderator.permissions, requiredPermission);
    return { isMod: hasPermission, moderator };
  }

  return { isMod: true, moderator };
}

/**
 * POST /api/mod/remove-post
 * Remove a post (requires mod permission)
 */
router.post('/remove-post', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { postId, reason } = z.object({
    postId: z.string().uuid(),
    reason: z.string().min(10, 'Removal reason must be at least 10 characters'),
  }).parse(req.body);
  await removeContent(req.userId!, 'post', postId, reason);
  res.json({ message: 'Post removed successfully', postId });
}));

/**
 * POST /api/mod/remove-comment
 * Remove a comment (requires mod permission)
 */
router.post('/remove-comment', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { commentId, reason } = z.object({
    commentId: z.string().uuid(),
    reason: z.string().min(10, 'Removal reason must be at least 10 characters'),
  }).parse(req.body);
  await removeContent(req.userId!, 'comment', commentId, reason);
  res.json({ message: 'Comment removed successfully', commentId });
}));

/**
 * POST /api/mod/restore-post
 * Restore a removed post (for appeals)
 */
router.post('/restore-post', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { postId } = z.object({ postId: z.string().uuid() }).parse(req.body);
  await restoreContent(req.userId!, 'post', postId);
  res.json({ message: 'Post restored successfully', postId });
}));

/**
 * POST /api/mod/restore-comment
 * Restore a removed comment (for appeals)
 */
router.post('/restore-comment', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { commentId } = z.object({ commentId: z.string().uuid() }).parse(req.body);
  await restoreContent(req.userId!, 'comment', commentId);
  res.json({ message: 'Comment restored successfully', commentId });
}));

/**
 * GET /api/mod/:spaceName/log
 * Get public mod log for a space
 */
router.get('/:spaceName/log', async (req, res: Response) => {
  try {
    const { spaceName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    // Get the space
    const space = await prisma.space.findUnique({
      where: { name: spaceName.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Get mod actions
    const [actions, totalCount] = await Promise.all([
      prisma.modAction.findMany({
        where: { spaceId: space.id },
        include: {
          mod: {
            select: {
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.modAction.count({
        where: { spaceId: space.id },
      }),
    ]);

    res.json({
      actions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get mod log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/mod/ban-user
 * Ban a user from a space (requires mod permission)
 */
router.post('/ban-user', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { username, spaceName, reason, duration } = z.object({
    username: z.string(),
    spaceName: z.string(),
    reason: z.string().min(10, 'Ban reason must be at least 10 characters'),
    duration: z.number().positive().max(3650).optional(), // days; omitted = permanent
  }).parse(req.body);
  const space = await prisma.space.findUnique({ where: { name: spaceName.toLowerCase() } });
  if (!space) throw notFound('Space not found');
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) throw notFound('User not found');
  const { ban } = await banUser(req.userId!, space.id, target.id, reason, duration);
  res.json({ message: 'User banned successfully', ban: { id: ban.id, username: target.username, expiresAt: ban.expiresAt } });
}));

/**
 * POST /api/mod/unban-user
 * Unban a user from a space (requires mod permission)
 */
router.post('/unban-user', authMiddleware, handler<AuthRequest>(async (req, res) => {
  const { username, spaceName } = z.object({ username: z.string(), spaceName: z.string() }).parse(req.body);
  const space = await prisma.space.findUnique({ where: { name: spaceName.toLowerCase() } });
  if (!space) throw notFound('Space not found');
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) throw notFound('User not found');
  await unbanUser(req.userId!, space.id, target.id);
  res.json({ message: 'User unbanned successfully', username: target.username });
}));

/**
 * GET /api/mod/:spaceName/bans
 * Get list of banned users in a space (mods only)
 */
router.get('/:spaceName/bans', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { spaceName } = req.params;

    // Get the space
    const space = await prisma.space.findUnique({
      where: { name: spaceName.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Check if requester is a moderator
    const { isMod } = await checkModeratorPermission(req.userId, space.id);

    if (!isMod) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be a moderator' });
      return;
    }

    // Get active bans
    const bans = await prisma.ban.findMany({
      where: {
        spaceId: space.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            username: true,
            avatarUrl: true,
          },
        },
        bannedByUser: {
          select: {
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bans });
  } catch (error) {
    console.error('Get bans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
