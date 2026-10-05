import { Router, Response } from 'express';
import { adminMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

/**
 * GET /api/admin/users
 * Get all users with stats (admin only)
 */
router.get('/users', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string | undefined;

    // Build where clause for search
    const whereClause: any = { deletedAt: null };
    if (search) {
      whereClause.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get users with basic info
    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        alignment: true,
        isAdmin: true,
        banned: true,
        isOver18: true,
        avatarUrl: true,
        bio: true,
      },
    });

    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Get post count and karma
        const postStats = await prisma.post.aggregate({
          where: { authorId: user.id, removed: false },
          _count: { id: true },
          _sum: { voteScore: true },
        });

        // Get comment count and karma
        const commentStats = await prisma.comment.aggregate({
          where: { authorId: user.id, removed: false },
          _count: { id: true },
          _sum: { voteScore: true },
        });

        // Get moderation positions
        const moderatorCount = await prisma.moderator.count({
          where: { userId: user.id },
        });

        return {
          ...user,
          stats: {
            postCount: postStats._count.id,
            postKarma: postStats._sum.voteScore || 0,
            commentCount: commentStats._count.id,
            commentKarma: commentStats._sum.voteScore || 0,
            totalKarma: (postStats._sum.voteScore || 0) + (commentStats._sum.voteScore || 0),
            moderatorOf: moderatorCount,
          },
        };
      })
    );

    // Get total count for pagination
    const totalCount = await prisma.user.count({ where: whereClause });

    res.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed user info (admin only)
 */
router.get('/users/:userId', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        moderatorRoles: {
          include: {
            space: {
              select: {
                name: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get ban history
    const bans = await prisma.ban.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        space: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    });

    // Get recent posts
    const recentPosts = await prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
        voteScore: true,
        removed: true,
        space: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    });

    // Get recent comments
    const recentComments = await prisma.comment.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        content: true,
        createdAt: true,
        voteScore: true,
        removed: true,
        post: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.json({
      user: { ...user, moderatorOf: user.moderatorRoles },
      bans,
      recentPosts,
      recentComments,
    });
  } catch (error) {
    console.error('Admin get user details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/stats
 * Get platform statistics (admin only)
 */
router.get('/stats', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalPosts,
      totalComments,
      totalSpaces,
      bannedUsers,
      adminUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.comment.count(),
      prisma.space.count(),
      prisma.user.count({ where: { banned: true } }),
      prisma.user.count({ where: { isAdmin: true } }),
    ]);

    // Get user signups in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSignups = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    res.json({
      stats: {
        totalUsers,
        totalPosts,
        totalComments,
        totalSpaces,
        bannedUsers,
        adminUsers,
        recentSignups,
      },
    });
  } catch (error) {
    console.error('Admin get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
