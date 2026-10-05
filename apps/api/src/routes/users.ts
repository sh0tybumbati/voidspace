import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth';
import { getSpaceAlignmentBreakdown } from '../services/alignment';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/users/:username
 * Get public user profile
 */
router.get('/:username', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        username: true,
        createdAt: true,
        alignment: true,
        avatarUrl: true,
        bio: true,
        // Don't expose private data
        email: false,
        passwordHash: false,
        preferences: false,
        isAdmin: false,
        banned: false,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Calculate karma (sum of post and comment vote scores)
    const postKarma = await prisma.post.aggregate({
      where: {
        authorId: user.id,
        removed: false,
      },
      _sum: {
        voteScore: true,
      },
    });

    const commentKarma = await prisma.comment.aggregate({
      where: {
        authorId: user.id,
        removed: false,
      },
      _sum: {
        voteScore: true,
      },
    });

    const totalKarma = (postKarma._sum.voteScore || 0) + (commentKarma._sum.voteScore || 0);

    // Get post and comment counts
    const postCount = await prisma.post.count({
      where: {
        authorId: user.id,
        removed: false,
      },
    });

    const commentCount = await prisma.comment.count({
      where: {
        authorId: user.id,
        removed: false,
      },
    });

    // Get spaces they moderate
    const moderatorships = await prisma.moderator.findMany({
      where: {
        userId: user.id,
      },
      select: {
        space: {
          select: {
            name: true,
            displayName: true,
            subscriberCount: true,
          },
        },
        isFounder: true,
        addedAt: true,
      },
      orderBy: {
        addedAt: 'asc',
      },
    });

    res.json({
      user: {
        ...user,
        karma: {
          total: totalKarma,
          post: postKarma._sum.voteScore || 0,
          comment: commentKarma._sum.voteScore || 0,
        },
        postCount,
        commentCount,
        moderatorOf: moderatorships.map(m => ({
          ...m.space,
          isFounder: m.isFounder,
          moderatorSince: m.addedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/users/:username
 * Update own user profile
 */
router.patch('/:username', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { username: true },
    });

    if (!currentUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if user is updating their own profile
    if (currentUser.username !== username.toLowerCase()) {
      res.status(403).json({ error: 'Forbidden', message: 'Can only update own profile' });
      return;
    }

    // Validation schema for profile updates
    const updateProfileSchema = z.object({
      avatarUrl: z.string().url().optional().nullable(),
      bio: z.string().max(500, 'Bio must be less than 500 characters').optional().nullable(),
      preferences: z.record(z.any()).optional().nullable(),
    });

    const validatedData = updateProfileSchema.parse(req.body);

    // Update user. preferences is a JSON column, so null must be Prisma.JsonNull.
    const { preferences, ...profileFields } = validatedData;
    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...profileFields,
        ...(preferences !== undefined && { preferences: preferences === null ? Prisma.JsonNull : (preferences as Prisma.InputJsonObject) }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        alignment: true,
        avatarUrl: true,
        bio: true,
        preferences: true,
      },
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:username/posts
 * Get user's posts with pagination
 * Optional query param: spaceName to filter by specific space
 */
router.get('/:username/posts', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;
    const spaceNameFilter = req.query.space as string | undefined;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build where clause
    const whereClause: any = {
      authorId: user.id,
      removed: false,
    };

    // Add space filter if provided
    if (spaceNameFilter) {
      const space = await prisma.space.findUnique({
        where: { name: spaceNameFilter.toLowerCase() },
        select: { id: true },
      });

      if (!space) {
        res.status(404).json({ error: 'Space not found' });
        return;
      }

      whereClause.spaceId = space.id;
    }

    // Get posts
    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        space: {
          select: {
            name: true,
            displayName: true,
            isNsfw: true,
          },
        },
        author: {
          select: {
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Get total count
    const totalCount = await prisma.post.count({
      where: whereClause,
    });

    res.json({
      posts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:username/comments
 * Get user's comments with pagination
 * Optional query param: space to filter by specific space
 */
router.get('/:username/comments', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;
    const spaceNameFilter = req.query.space as string | undefined;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build where clause
    const whereClause: any = {
      authorId: user.id,
      removed: false,
    };

    // Add space filter if provided
    if (spaceNameFilter) {
      const space = await prisma.space.findUnique({
        where: { name: spaceNameFilter.toLowerCase() },
        select: { id: true },
      });

      if (!space) {
        res.status(404).json({ error: 'Space not found' });
        return;
      }

      whereClause.post = {
        spaceId: space.id,
      };
    }

    // Get comments
    const comments = await prisma.comment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        post: {
          select: {
            id: true,
            title: true,
            space: {
              select: {
                name: true,
                displayName: true,
              },
            },
          },
        },
        author: {
          select: {
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Get total count
    const totalCount = await prisma.comment.count({
      where: whereClause,
    });

    res.json({
      comments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get user comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:username/alignment
 * Get user's alignment score
 */
router.get('/:username/alignment', async (req, res: Response) => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        alignment: true,
        username: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      username: user.username,
      alignment: user.alignment,
    });
  } catch (error) {
    console.error('Get user alignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:username/spaces/:spaceName/alignment
 * Get user's space-specific alignment score and stats
 * Used for mod eligibility assessment and citizenship evaluation
 */
router.get('/:username/spaces/:spaceName/alignment', async (req, res: Response) => {
  try {
    const { username, spaceName } = req.params;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, username: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Find space
    const space = await prisma.space.findUnique({
      where: { name: spaceName.toLowerCase() },
      select: { id: true, name: true, displayName: true },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Get space-specific alignment breakdown
    const alignmentStats = await getSpaceAlignmentBreakdown(user.id, space.id);

    res.json({
      username: user.username,
      space: {
        name: space.name,
        displayName: space.displayName,
      },
      ...alignmentStats,
    });
  } catch (error) {
    console.error('Get user space alignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/saved/posts
 * Get current user's saved posts
 */
router.get('/saved/posts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;

    // Get saved posts
    const savedPosts = await prisma.savedPost.findMany({
      where: {
        userId: req.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        post: {
          include: {
            space: {
              select: {
                name: true,
                displayName: true,
                isNsfw: true,
              },
            },
            author: {
              select: {
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Get total count
    const totalCount = await prisma.savedPost.count({
      where: {
        userId: req.userId,
      },
    });

    // Extract posts and mark them as saved
    const posts = savedPosts.map(sp => ({
      ...sp.post,
      isSaved: true,
    }));

    res.json({
      posts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get saved posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/saved/comments
 * Get current user's saved comments
 */
router.get('/saved/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;

    // Get saved comments
    const savedComments = await prisma.savedComment.findMany({
      where: {
        userId: req.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        comment: {
          include: {
            post: {
              select: {
                id: true,
                title: true,
                space: {
                  select: {
                    name: true,
                    displayName: true,
                  },
                },
              },
            },
            author: {
              select: {
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Get total count
    const totalCount = await prisma.savedComment.count({
      where: {
        userId: req.userId,
      },
    });

    // Extract comments and mark them as saved
    const comments = savedComments.map(sc => ({
      ...sc.comment,
      isSaved: true,
    }));

    res.json({
      comments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get saved comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
