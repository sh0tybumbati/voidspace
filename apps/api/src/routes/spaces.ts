import { Router, Response } from 'express';
import { z } from 'zod';
import { hasModPermission } from '../utils/permissions';
import { authMiddleware, optionalAuthMiddleware, AuthRequest, verifiedMiddleware } from '../middleware/auth';
import { prisma } from '../db';
import { canViewSpace, visibleSpaceWhere } from '../lib/visibility';

const router = Router();

/**
 * GET /api/spaces
 * List/search spaces
 */
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || 'subscribers'; // subscribers, new, name

    let orderBy: any;
    switch (sortBy) {
      case 'new':
        orderBy = { createdAt: 'desc' };
        break;
      case 'name':
        orderBy = { name: 'asc' };
        break;
      case 'subscribers':
      default:
        orderBy = { subscriberCount: 'desc' };
        break;
    }

    const where: any = {};
    where.AND = [visibleSpaceWhere(req.userId)];
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [spaces, totalCount] = await Promise.all([
      prisma.space.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          displayName: true,
          iconUrl: true,
          description: true,
          createdAt: true,
          subscriberCount: true,
          isNsfw: true,
          nsfwType: true,
        },
      }),
      prisma.space.count({ where }),
    ]);

    res.json({
      spaces,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get spaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/spaces
 * Create a new space
 */
router.post('/', authMiddleware, verifiedMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const createSpaceSchema = z.object({
      name: z
        .string()
        .min(3, 'Name must be at least 3 characters')
        .max(50, 'Name must be less than 50 characters')
        .regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only'),
      displayName: z.string().min(3).max(100),
      description: z.string().max(5000).optional(),
      rules: z.array(z.string()).optional(),
      sidebarContent: z.string().max(10000).optional(),
      isNsfw: z.boolean().optional(),
      nsfwType: z.enum(['none', 'partial', 'full']).optional(),
    });

    const validatedData = createSpaceSchema.parse(req.body);

    // Check if space name already exists
    const existingSpace = await prisma.space.findUnique({
      where: { name: validatedData.name },
    });

    if (existingSpace) {
      res.status(400).json({ error: 'Space name already taken' });
      return;
    }

    // Create space
    const space = await prisma.space.create({
      data: {
        name: validatedData.name,
        displayName: validatedData.displayName,
        description: validatedData.description,
        rules: validatedData.rules || [],
        sidebarContent: validatedData.sidebarContent,
        creatorId: req.userId,
        isNsfw: validatedData.isNsfw || false,
        nsfwType: validatedData.nsfwType || 'none',
        subscriberCount: 0,
        adEnabled: false,
      },
    });

    // Make creator a founder moderator
    await prisma.moderator.create({
      data: {
        userId: req.userId,
        spaceId: space.id,
        addedBy: req.userId,
        isFounder: true,
        permissions: {
          all: true, // Founder has all permissions
        },
      },
    });

    res.status(201).json({
      message: 'Space created successfully',
      space,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Create space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spaces/mine
 * The spaces you belong to or moderate, for the sidebar.
 */
router.get('/mine', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const spaces = await prisma.space.findMany({
      where: { deletedAt: null, OR: [{ subscriptions: { some: { userId: req.userId } } }, { moderators: { some: { userId: req.userId } } }] },
      orderBy: { name: 'asc' },
      take: 50,
      select: { name: true, displayName: true, iconUrl: true, subscriberCount: true, isNsfw: true, isPrivate: true, moderators: { where: { userId: req.userId }, select: { id: true } } },
    });
    res.json({ spaces: spaces.map(({ moderators, ...s }) => ({ ...s, isModerator: moderators.length > 0 })) });
  } catch (error) {
    console.error('Get my spaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spaces/:name
 * Get space details
 */
router.get('/:name', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
      include: {
        creator: {
          select: {
            username: true,
            avatarUrl: true,
          },
        },
        moderators: {
          include: {
            user: {
              select: {
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    if (!(await canViewSpace(space, req.userId))) {
      if (space.deletedAt) { res.status(404).json({ error: 'Space not found' }); return; }
      res.status(403).json({ error: 'Forbidden', code: 'private_space', message: 'This space is private.', space: { name: space.name, displayName: space.displayName, isPrivate: true } });
      return;
    }

    // Check if current user is subscribed
    let isSubscribed = false;
    if (req.userId) {
      const subscription = await prisma.subscription.findUnique({
        where: {
          userId_spaceId: {
            userId: req.userId,
            spaceId: space.id,
          },
        },
      });
      isSubscribed = !!subscription;
    }

    const mods = await prisma.moderator.findMany({ where: { spaceId: space.id }, orderBy: { addedAt: 'asc' }, include: { user: { select: { username: true } } } });
    const mine = req.userId ? mods.find((m) => m.userId === req.userId) : undefined;
    res.json({
      space: { ...space, moderators: mods.map((m) => ({ username: m.user.username, isFounder: m.isFounder })) },
      isSubscribed,
      isModerator: Boolean(mine),
      permissions: mine?.permissions ?? null,
    });
  } catch (error) {
    console.error('Get space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/spaces/:name
 * Update space (mods only)
 */
const uploadPath = z.string().regex(/^\/uploads\/[\w./-]+$/).nullable().optional();

router.patch('/:name', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Check if user is moderator
    const moderator = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: space.id,
        },
      },
    });

    if (!moderator) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be moderator' });
      return;
    }

    // Check permission
    const hasPermission = hasModPermission(moderator.permissions, 'edit_space');
    if (!hasPermission) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }

    const updateSpaceSchema = z.object({
      displayName: z.string().min(3).max(100).optional(),
      description: z.string().max(5000).optional(),
      sidebarContent: z.string().max(10000).optional(),
      iconUrl: uploadPath,
      bannerUrl: uploadPath,
    });

    const validatedData = updateSpaceSchema.parse(req.body);

    // Pictures must be images this moderator uploaded themselves (or null to go back to the default look).
    for (const key of ['iconUrl', 'bannerUrl'] as const) {
      const url = validatedData[key];
      if (url && !(await prisma.upload.findFirst({ where: { url, userId: req.userId } }))) {
        res.status(400).json({ error: 'Bad Request', message: 'Upload the picture first, then use it.' });
        return;
      }
    }

    const updatedSpace = await prisma.space.update({
      where: { id: space.id },
      data: validatedData,
    });

    res.json({
      message: 'Space updated successfully',
      space: updatedSpace,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Update space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/spaces/:name/subscribe
 * Subscribe to a space
 */
router.post('/:name/subscribe', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    if (space.deletedAt) { res.status(404).json({ error: 'Space not found' }); return; }
    if (space.isPrivate && !(await canViewSpace(space, req.userId))) {
      res.status(403).json({ error: 'Forbidden', code: 'private_space', message: 'This space is private and not accepting new members.' });
      return;
    }

    // Check if already subscribed
    const existing = await prisma.subscription.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: space.id,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Already subscribed' });
      return;
    }

    // Create subscription
    await prisma.subscription.create({
      data: {
        userId: req.userId,
        spaceId: space.id,
      },
    });

    // Increment subscriber count
    await prisma.space.update({
      where: { id: space.id },
      data: { subscriberCount: { increment: 1 } },
    });

    res.json({ message: 'Subscribed successfully' });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/spaces/:name/subscribe
 * Unsubscribe from a space
 */
router.delete('/:name/subscribe', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Delete subscription
    const deleted = await prisma.subscription.deleteMany({
      where: {
        userId: req.userId,
        spaceId: space.id,
      },
    });

    if (deleted.count === 0) {
      res.status(400).json({ error: 'Not subscribed' });
      return;
    }

    // Decrement subscriber count
    await prisma.space.update({
      where: { id: space.id },
      data: { subscriberCount: { decrement: 1 } },
    });

    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spaces/:name/rules
 * Get space rules
 */
router.get('/:name/rules', async (req, res: Response) => {
  try {
    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
      select: {
        rules: true,
        displayName: true,
        iconUrl: true,
      },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    res.json({
      spaceName: space.displayName,
      rules: space.rules || [],
    });
  } catch (error) {
    console.error('Get space rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/spaces/:name/rules
 * Update space rules (mods only)
 */
router.patch('/:name/rules', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Check if user is moderator
    const moderator = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: space.id,
        },
      },
    });

    if (!moderator) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be moderator' });
      return;
    }

    // Check permission
    const hasPermission = hasModPermission(moderator.permissions, 'edit_rules');
    if (!hasPermission) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }

    const rulesSchema = z.object({
      rules: z.array(z.string()),
    });

    const { rules } = rulesSchema.parse(req.body);

    await prisma.space.update({
      where: { id: space.id },
      data: { rules },
    });

    res.json({ message: 'Rules updated successfully', rules });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Update space rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spaces/:name/posts
 * Get posts from a specific space
 */
router.get('/:name/posts', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sort as string) || 'hot'; // hot, new, top

    // Find the space
    const space = await prisma.space.findUnique({
      where: { name },
      select: { id: true },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Sorting
    let orderBy: any;
    switch (sortBy) {
      case 'new':
        orderBy = { createdAt: 'desc' };
        break;
      case 'top':
        orderBy = { voteScore: 'desc' };
        break;
      case 'hot':
      default:
        orderBy = { hotScore: 'desc' };
        break;
    }

    const where = {
      spaceId: space.id,
      removed: false,
    };

    const [posts, totalCount] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              username: true,
              avatarUrl: true,
            },
          },
          space: {
            select: {
              name: true,
              displayName: true,
              iconUrl: true,
              isNsfw: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    // Get user votes if authenticated
    let userVotes: Record<string, number> = {};
    if (req.userId) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: req.userId,
          targetId: { in: posts.map((p) => p.id) },
          targetType: 'post',
        },
        select: {
          targetId: true,
          voteValue: true,
        },
      });
      userVotes = votes.reduce((acc, v) => ({ ...acc, [v.targetId]: v.voteValue }), {});
    }

    // Format posts
    const formattedPosts = posts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      url: post.url,
      postType: post.postType,
      isNsfw: post.isNsfw,
      createdAt: post.createdAt,
      voteScore: post.voteScore,
      commentCount: post._count.comments,
      isEdited: post.editedAt != null,
      author: post.author,
      space: post.space,
      userVote: userVotes[post.id] || null,
    }));

    res.json({
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get space posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/spaces/:name
 * Delete a space (founder only - TEMPORARY for development)
 * TODO: Replace with community vote system in production
 */
router.delete('/:name', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Check if user is founder
    const moderator = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: space.id,
        },
      },
    });

    if (!moderator || !moderator.isFounder) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Only the founder can delete a space'
      });
      return;
    }

    // Delete related data first (foreign key constraints aren't set to cascade)
    // Delete in order: votes, comments, posts, subscriptions, moderators, space

    // Delete all votes on posts and comments in this space
    const posts = await prisma.post.findMany({
      where: { spaceId: space.id },
      select: { id: true },
    });
    const postIds = posts.map(p => p.id);

    if (postIds.length > 0) {
      // Delete votes on posts
      await prisma.vote.deleteMany({
        where: {
          targetId: { in: postIds },
          targetType: 'post',
        },
      });

      // Get all comment IDs from these posts
      const comments = await prisma.comment.findMany({
        where: { postId: { in: postIds } },
        select: { id: true },
      });
      const commentIds = comments.map(c => c.id);

      if (commentIds.length > 0) {
        // Delete votes on comments
        await prisma.vote.deleteMany({
          where: {
            targetId: { in: commentIds },
            targetType: 'comment',
          },
        });

        // Delete comments
        await prisma.comment.deleteMany({
          where: { postId: { in: postIds } },
        });
      }

      // Delete posts
      await prisma.post.deleteMany({
        where: { spaceId: space.id },
      });
    }

    // Delete subscriptions
    await prisma.subscription.deleteMany({
      where: { spaceId: space.id },
    });

    // Delete moderators
    await prisma.moderator.deleteMany({
      where: { spaceId: space.id },
    });

    // Finally, delete the space
    await prisma.space.delete({
      where: { id: space.id },
    });

    res.json({
      message: 'Space deleted successfully',
      warning: 'This is a development feature. In production, space deletion requires a community vote.'
    });
  } catch (error) {
    console.error('Delete space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spaces/:name/flairs
 * Get all flairs for a space
 */
router.get('/:name/flairs', async (req, res: Response) => {
  try {
    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
      select: { id: true },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    const flairs = await prisma.flair.findMany({
      where: { spaceId: space.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ flairs });
  } catch (error) {
    console.error('Get flairs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/spaces/:name/flairs
 * Create a new flair (moderators only)
 */
router.post('/:name/flairs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Check if user is moderator
    const moderator = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: space.id,
        },
      },
    });

    if (!moderator) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be moderator' });
      return;
    }

    // Check permission
    const hasPermission = hasModPermission(moderator.permissions, 'manage_flairs');
    if (!hasPermission) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }

    const flairSchema = z.object({
      text: z.string().min(1).max(30),
      textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color'),
      bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color'),
    });

    const validatedData = flairSchema.parse(req.body);

    const flair = await prisma.flair.create({
      data: {
        spaceId: space.id,
        text: validatedData.text,
        textColor: validatedData.textColor,
        bgColor: validatedData.bgColor,
      },
    });

    res.status(201).json({
      message: 'Flair created successfully',
      flair,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Create flair error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/spaces/:name/flairs/:flairId
 * Update a flair (moderators only)
 */
router.patch('/:name/flairs/:flairId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, flairId } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Check if user is moderator
    const moderator = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: space.id,
        },
      },
    });

    if (!moderator) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be moderator' });
      return;
    }

    // Check permission
    const hasPermission = hasModPermission(moderator.permissions, 'manage_flairs');
    if (!hasPermission) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }

    // Verify flair belongs to this space
    const existingFlair = await prisma.flair.findUnique({
      where: { id: flairId },
    });

    if (!existingFlair || existingFlair.spaceId !== space.id) {
      res.status(404).json({ error: 'Flair not found' });
      return;
    }

    const flairSchema = z.object({
      text: z.string().min(1).max(30).optional(),
      textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color').optional(),
      bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color').optional(),
    });

    const validatedData = flairSchema.parse(req.body);

    const flair = await prisma.flair.update({
      where: { id: flairId },
      data: validatedData,
    });

    res.json({
      message: 'Flair updated successfully',
      flair,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Update flair error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/spaces/:name/flairs/:flairId
 * Delete a flair (moderators only)
 */
router.delete('/:name/flairs/:flairId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, flairId } = req.params;

    const space = await prisma.space.findUnique({
      where: { name: name.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Check if user is moderator
    const moderator = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: space.id,
        },
      },
    });

    if (!moderator) {
      res.status(403).json({ error: 'Forbidden', message: 'Must be moderator' });
      return;
    }

    // Check permission
    const hasPermission = hasModPermission(moderator.permissions, 'manage_flairs');
    if (!hasPermission) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }

    // Verify flair belongs to this space
    const existingFlair = await prisma.flair.findUnique({
      where: { id: flairId },
    });

    if (!existingFlair || existingFlair.spaceId !== space.id) {
      res.status(404).json({ error: 'Flair not found' });
      return;
    }

    await prisma.flair.delete({
      where: { id: flairId },
    });

    res.json({ message: 'Flair deleted successfully' });
  } catch (error) {
    console.error('Delete flair error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
