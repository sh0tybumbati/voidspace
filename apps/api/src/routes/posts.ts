import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth';
import { updateHotScoreAfterVote } from '../services/hotScore';
import { updateUserAlignmentOnVote } from '../jobs/alignmentUpdate';
import { prisma } from '../db';
import { canViewSpace, canViewSpaceById, visibleSpaceWhere } from '../lib/visibility';

const router = Router();

/**
 * GET /api/posts
 * Get feed (all/subscribed)
 */
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;
    const feedType = (req.query.feed as string) || 'hot'; // hot, new, top, subscribed
    const sortBy = (req.query.sort as string) || feedType;

    let where: any = { removed: false };
    where.space = visibleSpaceWhere(req.userId);

    // Subscribed feed - only show posts from subscribed spaces
    if (feedType === 'subscribed' && req.userId) {
      const subscriptions = await prisma.subscription.findMany({
        where: { userId: req.userId },
        select: { spaceId: true },
      });
      const spaceIds = subscriptions.map((s) => s.spaceId);
      where.spaceId = { in: spaceIds };
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
              isNsfw: true,
            },
          },
          flair: true,
        },
      }),
      prisma.post.count({ where }),
    ]);

    // Get user's votes if authenticated
    let userVotes: Record<string, number> = {};
    if (req.userId) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: req.userId,
          targetId: { in: posts.map((p) => p.id) },
          targetType: 'post',
        },
      });
      userVotes = votes.reduce((acc, vote) => {
        acc[vote.targetId] = vote.voteValue;
        return acc;
      }, {} as Record<string, number>);
    }

    const postsWithVotes = posts.map((post) => ({
      ...post,
      userVote: userVotes[post.id] || null,
    }));

    res.json({
      posts: postsWithVotes,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spaces/:spaceName/posts
 * Get posts in a specific space
 */
router.get('/spaces/:spaceName/posts', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { spaceName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sort as string) || 'hot';

    const space = await prisma.space.findUnique({
      where: { name: spaceName.toLowerCase() },
    });

    if (!space) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    if (!(await canViewSpace(space, req.userId))) {
      if (space.deletedAt) { res.status(404).json({ error: 'Space not found' }); return; }
      res.status(403).json({ error: 'Forbidden', code: 'private_space', message: 'This space is private.' });
      return;
    }

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

    const [posts, totalCount] = await Promise.all([
      prisma.post.findMany({
        where: {
          spaceId: space.id,
          removed: false,
        },
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
          flair: true,
        },
      }),
      prisma.post.count({
        where: {
          spaceId: space.id,
          removed: false,
        },
      }),
    ]);

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
    console.error('Get space posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/posts
 * Create a new post
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const createPostSchema = z.object({
      spaceId: z.string().uuid(),
      title: z.string().min(1).max(300),
      content: z.string().optional(),
      postType: z.enum(['text', 'link', 'image', 'video']),
      url: z.string().url().optional(),
      flairId: z.string().uuid().optional(),
      isNsfw: z.boolean().optional(),
    });

    const validatedData = createPostSchema.parse(req.body);

    if (!(await canViewSpaceById(validatedData.spaceId, req.userId))) {
      res.status(404).json({ error: 'Space not found' });
      return;
    }

    // Validate post type and URL
    if (['link', 'image', 'video'].includes(validatedData.postType) && !validatedData.url) {
      res.status(400).json({ error: 'URL required for link, image, and video posts' });
      return;
    }

    // Check if user is banned in this space
    const ban = await prisma.ban.findFirst({
      where: {
        userId: req.userId,
        spaceId: validatedData.spaceId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (ban) {
      res.status(403).json({ error: 'You are banned from this space' });
      return;
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        authorId: req.userId,
        spaceId: validatedData.spaceId,
        title: validatedData.title,
        content: validatedData.content,
        postType: validatedData.postType,
        url: validatedData.url,
        flairId: validatedData.flairId,
        isNsfw: validatedData.isNsfw || false,
        voteScore: 0,
        hotScore: 0,
        commentCount: 0,
      },
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
          },
        },
        flair: true,
      },
    });

    // Calculate initial hot score
    await updateHotScoreAfterVote(post.id);

    res.status(201).json({
      message: 'Post created successfully',
      post,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/posts/:id
 * Get single post
 */
router.get('/:id', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
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
            isNsfw: true,
          },
        },
        flair: true,
      },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (!(await canViewSpaceById(post.spaceId, req.userId))) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Get user's vote if authenticated
    let userVote = null;
    if (req.userId) {
      const vote = await prisma.vote.findUnique({
        where: {
          userId_targetId_targetType: {
            userId: req.userId,
            targetId: post.id,
            targetType: 'post',
          },
        },
      });
      userVote = vote?.voteValue || null;
    }

    res.json({
      post: {
        ...post,
        userVote,
      },
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/posts/:id
 * Edit post (author only)
 */
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.authorId !== req.userId) {
      res.status(403).json({ error: 'Forbidden', message: 'Can only edit own posts' });
      return;
    }

    const updatePostSchema = z.object({
      title: z.string().min(1).max(300).optional(),
      content: z.string().optional(),
      flairId: z.string().uuid().nullable().optional(),
    });

    const validatedData = updatePostSchema.parse(req.body);

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...validatedData,
        editedAt: new Date(),
      },
      include: {
        flair: true,
      },
    });

    res.json({
      message: 'Post updated successfully',
      post: updatedPost,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete post (author or mod)
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: { space: true },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user is author or moderator
    const isMod = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: post.spaceId,
        },
      },
    });

    if (post.authorId !== req.userId && !isMod) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await prisma.post.delete({
      where: { id },
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/posts/:id/vote
 * Vote on a post
 */
router.post('/:id/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const voteSchema = z.object({
      voteValue: z.enum(['1', '-1']).transform((val) => parseInt(val)),
    });

    const { voteValue } = voteSchema.parse(req.body);

    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check for existing vote
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_targetId_targetType: {
          userId: req.userId,
          targetId: id,
          targetType: 'post',
        },
      },
    });

    if (existingVote) {
      if (existingVote.voteValue === voteValue) {
        // Remove vote (clicking same vote again)
        await prisma.vote.delete({
          where: { id: existingVote.id },
        });

        await prisma.post.update({
          where: { id },
          data: { voteScore: { decrement: voteValue } },
        });

        // Update hot score after vote change
        await updateHotScoreAfterVote(id);

        // Update author's alignment in real-time
        try {
          await updateUserAlignmentOnVote(post.authorId);
        } catch (error) {
          console.error('Failed to update alignment on vote removal:', error);
        }

        res.json({ message: 'Vote removed', voteScore: post.voteScore - voteValue });
      } else {
        // Change vote
        await prisma.vote.update({
          where: { id: existingVote.id },
          data: { voteValue },
        });

        // Update is +2 or -2 (from -1 to +1 or vice versa)
        const delta = voteValue * 2;
        await prisma.post.update({
          where: { id },
          data: { voteScore: { increment: delta } },
        });

        // Update hot score after vote change
        await updateHotScoreAfterVote(id);

        // Update author's alignment in real-time
        try {
          await updateUserAlignmentOnVote(post.authorId);
        } catch (error) {
          console.error('Failed to update alignment on vote change:', error);
        }

        res.json({ message: 'Vote updated', voteScore: post.voteScore + delta });
      }
    } else {
      // New vote
      await prisma.vote.create({
        data: {
          userId: req.userId,
          targetId: id,
          targetType: 'post',
          voteValue,
        },
      });

      await prisma.post.update({
        where: { id },
        data: { voteScore: { increment: voteValue } },
      });

      // Update hot score after vote change
      await updateHotScoreAfterVote(id);

      // Update author's alignment in real-time
      try {
        await updateUserAlignmentOnVote(post.authorId);
      } catch (error) {
        console.error('Failed to update alignment on new vote:', error);
      }

      res.json({ message: 'Vote added', voteScore: post.voteScore + voteValue });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Vote on post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/posts/:id/vote
 * Remove vote from post
 */
router.delete('/:id/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const vote = await prisma.vote.findUnique({
      where: {
        userId_targetId_targetType: {
          userId: req.userId,
          targetId: id,
          targetType: 'post',
        },
      },
    });

    if (!vote) {
      res.status(404).json({ error: 'No vote found' });
      return;
    }

    await prisma.vote.delete({
      where: { id: vote.id },
    });

    await prisma.post.update({
      where: { id },
      data: { voteScore: { decrement: vote.voteValue } },
    });

    res.json({ message: 'Vote removed successfully' });
  } catch (error) {
    console.error('Remove vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete own post (author only)
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Get the post
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user is the author
    if (post.authorId !== req.userId) {
      res.status(403).json({ error: 'You can only delete your own posts' });
      return;
    }

    // Check if already removed/deleted
    if (post.removed || post.removedBy) {
      res.status(400).json({ error: 'Post is already removed' });
      return;
    }

    // Mark post as removed and set removedBy to author (indicates self-deletion)
    await prisma.post.update({
      where: { id },
      data: {
        removed: true,
        removedBy: req.userId,
        removalReason: 'Deleted by author',
      },
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/posts/:id/save
 * Save a post
 */
router.post('/:id/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Check if post exists
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if already saved
    const existing = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId: req.userId,
          postId: id,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Post already saved' });
      return;
    }

    // Save the post
    await prisma.savedPost.create({
      data: {
        userId: req.userId,
        postId: id,
      },
    });

    res.json({ message: 'Post saved successfully' });
  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/posts/:id/save
 * Unsave a post
 */
router.delete('/:id/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Delete the saved post
    await prisma.savedPost.deleteMany({
      where: {
        userId: req.userId,
        postId: id,
      },
    });

    res.json({ message: 'Post unsaved successfully' });
  } catch (error) {
    console.error('Unsave post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
