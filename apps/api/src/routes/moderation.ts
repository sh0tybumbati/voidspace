import { Router, Response } from 'express';
import { z } from 'zod';
import { hasModPermission } from '../utils/permissions';
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
router.post('/remove-post', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const schema = z.object({
      postId: z.string().uuid(),
      reason: z.string().min(10, 'Removal reason must be at least 10 characters'),
    });

    const { postId, reason } = schema.parse(req.body);

    // Get the post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { space: true },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user is a moderator
    const { isMod } = await checkModeratorPermission(
      req.userId,
      post.spaceId,
      'remove_posts'
    );

    if (!isMod) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be a moderator' });
      return;
    }

    // Mark post as removed
    await prisma.post.update({
      where: { id: postId },
      data: {
        removed: true,
        removedBy: req.userId,
        removalReason: reason,
      },
    });

    // Log the mod action
    await prisma.modAction.create({
      data: {
        modId: req.userId,
        spaceId: post.spaceId,
        actionType: 'remove_post',
        targetId: postId,
        targetType: 'post',
        reason,
      },
    });

    res.json({
      message: 'Post removed successfully',
      postId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Remove post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/mod/remove-comment
 * Remove a comment (requires mod permission)
 */
router.post('/remove-comment', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const schema = z.object({
      commentId: z.string().uuid(),
      reason: z.string().min(10, 'Removal reason must be at least 10 characters'),
    });

    const { commentId, reason } = schema.parse(req.body);

    // Get the comment and its post to find the space
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          include: { space: true },
        },
      },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if user is a moderator
    const { isMod } = await checkModeratorPermission(
      req.userId,
      comment.post.spaceId,
      'remove_comments'
    );

    if (!isMod) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be a moderator' });
      return;
    }

    // Mark comment as removed
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        removed: true,
        removedBy: req.userId,
        removalReason: reason,
      },
    });

    // Log the mod action
    await prisma.modAction.create({
      data: {
        modId: req.userId,
        spaceId: comment.post.spaceId,
        actionType: 'remove_comment',
        targetId: commentId,
        targetType: 'comment',
        reason,
      },
    });

    res.json({
      message: 'Comment removed successfully',
      commentId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Remove comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/mod/restore-post
 * Restore a removed post (for appeals)
 */
router.post('/restore-post', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const schema = z.object({
      postId: z.string().uuid(),
    });

    const { postId } = schema.parse(req.body);

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user is a moderator
    const { isMod } = await checkModeratorPermission(req.userId, post.spaceId);

    if (!isMod) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be a moderator' });
      return;
    }

    // Restore the post
    await prisma.post.update({
      where: { id: postId },
      data: {
        removed: false,
        removedBy: null,
        removalReason: null,
      },
    });

    res.json({
      message: 'Post restored successfully',
      postId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Restore post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/mod/restore-comment
 * Restore a removed comment (for appeals)
 */
router.post('/restore-comment', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const schema = z.object({
      commentId: z.string().uuid(),
    });

    const { commentId } = schema.parse(req.body);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if user is a moderator
    const { isMod } = await checkModeratorPermission(req.userId, comment.post.spaceId);

    if (!isMod) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be a moderator' });
      return;
    }

    // Restore the comment
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        removed: false,
        removedBy: null,
        removalReason: null,
      },
    });

    res.json({
      message: 'Comment restored successfully',
      commentId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Restore comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
router.post('/ban-user', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const schema = z.object({
      username: z.string(),
      spaceName: z.string(),
      reason: z.string().min(10, 'Ban reason must be at least 10 characters'),
      duration: z.number().optional(), // Duration in days, undefined = permanent
    });

    const { username, spaceName, reason, duration } = schema.parse(req.body);

    // Get the space
    const space = await prisma.space.findUnique({
      where: { name: spaceName.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Get the user to ban
    const userToBan = await prisma.user.findUnique({
      where: { username },
    });

    if (!userToBan) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if requester is a moderator
    const { isMod } = await checkModeratorPermission(req.userId, space.id, 'ban_users');

    if (!isMod) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be a moderator' });
      return;
    }

    // Cannot ban another moderator
    const targetIsMod = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: userToBan.id,
          spaceId: space.id,
        },
      },
    });

    if (targetIsMod) {
      res.status(400).json({ error: 'Cannot ban a moderator. Remove them as mod first.' });
      return;
    }

    // Check if already banned
    const existingBan = await prisma.ban.findFirst({
      where: {
        userId: userToBan.id,
        spaceId: space.id,
        isActive: true,
      },
    });

    if (existingBan) {
      res.status(400).json({ error: 'User is already banned from this space' });
      return;
    }

    // Calculate expiry date
    const expiresAt = duration
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
      : null;

    // Create ban
    const ban = await prisma.ban.create({
      data: {
        userId: userToBan.id,
        spaceId: space.id,
        bannedBy: req.userId,
        reason,
        expiresAt,
        isActive: true,
      },
    });

    // Log the mod action
    await prisma.modAction.create({
      data: {
        modId: req.userId,
        spaceId: space.id,
        actionType: 'ban_user',
        targetId: userToBan.id,
        targetType: 'user',
        reason: `Banned ${duration ? `for ${duration} days` : 'permanently'}: ${reason}`,
      },
    });

    res.json({
      message: 'User banned successfully',
      ban: {
        id: ban.id,
        username: userToBan.username,
        expiresAt: ban.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/mod/unban-user
 * Unban a user from a space (requires mod permission)
 */
router.post('/unban-user', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const schema = z.object({
      username: z.string(),
      spaceName: z.string(),
    });

    const { username, spaceName } = schema.parse(req.body);

    // Get the space
    const space = await prisma.space.findUnique({
      where: { name: spaceName.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if requester is a moderator
    const { isMod } = await checkModeratorPermission(req.userId, space.id, 'ban_users');

    if (!isMod) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be a moderator' });
      return;
    }

    // Find active ban
    const ban = await prisma.ban.findFirst({
      where: {
        userId: user.id,
        spaceId: space.id,
        isActive: true,
      },
    });

    if (!ban) {
      res.status(404).json({ error: 'No active ban found for this user' });
      return;
    }

    // Deactivate the ban
    await prisma.ban.update({
      where: { id: ban.id },
      data: { isActive: false },
    });

    // Log the mod action
    await prisma.modAction.create({
      data: {
        modId: req.userId,
        spaceId: space.id,
        actionType: 'unban_user',
        targetId: user.id,
        targetType: 'user',
        reason: 'User unbanned',
      },
    });

    res.json({
      message: 'User unbanned successfully',
      username: user.username,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
