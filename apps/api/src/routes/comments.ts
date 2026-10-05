import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth';
import { updateUserAlignmentOnVote } from '../jobs/alignmentUpdate';
import { prisma } from '../db';

const router = Router();

/**
 * POST /api/comments
 * Create a new comment
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const createCommentSchema = z.object({
      postId: z.string().uuid(),
      parentCommentId: z.string().uuid().optional(),
      content: z.string().min(1).max(10000),
      imageUrl: z.string().url().optional(),
    });

    const validatedData = createCommentSchema.parse(req.body);

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: validatedData.postId },
      include: { space: true },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user is banned in this space
    const ban = await prisma.ban.findFirst({
      where: {
        userId: req.userId,
        spaceId: post.spaceId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (ban) {
      res.status(403).json({ error: 'You are banned from this space' });
      return;
    }

    // If replying to a comment, check it exists and calculate depth
    let depthLevel = 0;
    if (validatedData.parentCommentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: validatedData.parentCommentId },
      });

      if (!parentComment) {
        res.status(404).json({ error: 'Parent comment not found' });
        return;
      }

      if (parentComment.postId !== validatedData.postId) {
        res.status(400).json({ error: 'Parent comment is not in the same post' });
        return;
      }

      // Calculate depth level (parent depth + 1)
      depthLevel = parentComment.depthLevel + 1;
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        postId: validatedData.postId,
        authorId: req.userId,
        parentCommentId: validatedData.parentCommentId,
        content: validatedData.content,
        imageUrl: validatedData.imageUrl,
        voteScore: 0,
        depthLevel,
      },
      include: {
        author: {
          select: {
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update post comment count
    await prisma.post.update({
      where: { id: validatedData.postId },
      data: { commentCount: { increment: 1 } },
    });

    res.status(201).json({
      message: 'Comment created successfully',
      comment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/posts/:postId/comments
 * Get comments for a post (threaded)
 */
router.get('/posts/:postId/comments', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const sortBy = (req.query.sort as string) || 'top'; // top, new, old

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    let orderBy: any;
    switch (sortBy) {
      case 'new':
        orderBy = { createdAt: 'desc' };
        break;
      case 'old':
        orderBy = { createdAt: 'asc' };
        break;
      case 'top':
      default:
        orderBy = { voteScore: 'desc' };
        break;
    }

    // Get all comments for the post
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        removed: false,
      },
      orderBy,
      include: {
        author: {
          select: {
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Get user's votes if authenticated
    let userVotes: Record<string, number> = {};
    if (req.userId) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: req.userId,
          targetId: { in: comments.map((c) => c.id) },
          targetType: 'comment',
        },
      });
      userVotes = votes.reduce((acc, vote) => {
        acc[vote.targetId] = vote.voteValue;
        return acc;
      }, {} as Record<string, number>);
    }

    const commentsWithVotes = comments.map((comment) => ({
      ...comment,
      userVote: userVotes[comment.id] || null,
    }));

    res.json({
      comments: commentsWithVotes,
      totalCount: comments.length,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/comments/:id
 * Get single comment with replies
 */
router.get('/:id', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            username: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
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

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Get user's vote if authenticated
    let userVote = null;
    if (req.userId) {
      const vote = await prisma.vote.findUnique({
        where: {
          userId_targetId_targetType: {
            userId: req.userId,
            targetId: comment.id,
            targetType: 'comment',
          },
        },
      });
      userVote = vote?.voteValue || null;
    }

    res.json({
      comment: {
        ...comment,
        userVote,
      },
    });
  } catch (error) {
    console.error('Get comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/comments/:id
 * Edit comment (author only)
 */
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.authorId !== req.userId) {
      res.status(403).json({ error: 'Forbidden', message: 'Can only edit own comments' });
      return;
    }

    const updateCommentSchema = z.object({
      content: z.string().min(1).max(10000),
      imageUrl: z.string().url().optional().nullable(),
    });

    const validatedData = updateCommentSchema.parse(req.body);

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        content: validatedData.content,
        imageUrl: validatedData.imageUrl,
        editedAt: new Date(),
      },
    });

    res.json({
      message: 'Comment updated successfully',
      comment: updatedComment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/comments/:id
 * Delete comment (author or mod)
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { post: { include: { space: true } } },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if user is author or moderator
    const isMod = await prisma.moderator.findUnique({
      where: {
        userId_spaceId: {
          userId: req.userId,
          spaceId: comment.post.spaceId,
        },
      },
    });

    if (comment.authorId !== req.userId && !isMod) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Delete comment (cascade will handle replies)
    await prisma.comment.delete({
      where: { id },
    });

    // Decrement post comment count
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/comments/:id/vote
 * Vote on a comment
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

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check for existing vote
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_targetId_targetType: {
          userId: req.userId,
          targetId: id,
          targetType: 'comment',
        },
      },
    });

    if (existingVote) {
      if (existingVote.voteValue === voteValue) {
        // Remove vote (clicking same vote again)
        await prisma.vote.delete({
          where: { id: existingVote.id },
        });

        await prisma.comment.update({
          where: { id },
          data: { voteScore: { decrement: voteValue } },
        });

        // Update author's alignment in real-time
        try {
          await updateUserAlignmentOnVote(comment.authorId);
        } catch (error) {
          console.error('Failed to update alignment on vote removal:', error);
        }

        res.json({ message: 'Vote removed', voteScore: comment.voteScore - voteValue });
      } else {
        // Change vote
        await prisma.vote.update({
          where: { id: existingVote.id },
          data: { voteValue },
        });

        // Update is +2 or -2 (from -1 to +1 or vice versa)
        const delta = voteValue * 2;
        await prisma.comment.update({
          where: { id },
          data: { voteScore: { increment: delta } },
        });

        // Update author's alignment in real-time
        try {
          await updateUserAlignmentOnVote(comment.authorId);
        } catch (error) {
          console.error('Failed to update alignment on vote change:', error);
        }

        res.json({ message: 'Vote updated', voteScore: comment.voteScore + delta });
      }
    } else {
      // New vote
      await prisma.vote.create({
        data: {
          userId: req.userId,
          targetId: id,
          targetType: 'comment',
          voteValue,
        },
      });

      await prisma.comment.update({
        where: { id },
        data: { voteScore: { increment: voteValue } },
      });

      // Update author's alignment in real-time
      try {
        await updateUserAlignmentOnVote(comment.authorId);
      } catch (error) {
        console.error('Failed to update alignment on new vote:', error);
      }

      res.json({ message: 'Vote added', voteScore: comment.voteScore + voteValue });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Vote on comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/comments/:id/vote
 * Remove vote from comment
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
          targetType: 'comment',
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

    await prisma.comment.update({
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
 * DELETE /api/comments/:id
 * Delete own comment (author only)
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Get the comment
    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if user is the author
    if (comment.authorId !== req.userId) {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    // Check if already removed/deleted
    if (comment.removed || comment.removedBy) {
      res.status(400).json({ error: 'Comment is already removed' });
      return;
    }

    // Mark comment as removed and set removedBy to author (indicates self-deletion)
    await prisma.comment.update({
      where: { id },
      data: {
        removed: true,
        removedBy: req.userId,
        removalReason: 'Deleted by author',
      },
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/comments/:id/save
 * Save a comment
 */
router.post('/:id/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Check if comment exists
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check if already saved
    const existing = await prisma.savedComment.findUnique({
      where: {
        userId_commentId: {
          userId: req.userId,
          commentId: id,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Comment already saved' });
      return;
    }

    // Save the comment
    await prisma.savedComment.create({
      data: {
        userId: req.userId,
        commentId: id,
      },
    });

    res.json({ message: 'Comment saved successfully' });
  } catch (error) {
    console.error('Save comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/comments/:id/save
 * Unsave a comment
 */
router.delete('/:id/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Delete the saved comment
    await prisma.savedComment.deleteMany({
      where: {
        userId: req.userId,
        commentId: id,
      },
    });

    res.json({ message: 'Comment unsaved successfully' });
  } catch (error) {
    console.error('Unsave comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
