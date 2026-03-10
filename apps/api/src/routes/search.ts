import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { optionalAuthMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/search
 * Global search for posts, spaces, and users
 */
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const type = (req.query.type as string) || 'all'; // all, posts, spaces, users
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (!query || query.trim().length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters' });
      return;
    }

    const searchTerm = query.trim();
    const results: any = {
      query: searchTerm,
      posts: [],
      spaces: [],
      users: [],
    };

    // Search posts
    if (type === 'all' || type === 'posts') {
      results.posts = await prisma.post.findMany({
        where: {
          removed: false,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { content: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [
          { voteScore: 'desc' },
          { createdAt: 'desc' },
        ],
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
          _count: {
            select: {
              comments: true,
            },
          },
        },
      });

      // Map to include commentCount
      results.posts = results.posts.map((post: any) => ({
        ...post,
        commentCount: post._count.comments,
        _count: undefined,
      }));
    }

    // Search spaces
    if (type === 'all' || type === 'spaces') {
      results.spaces = await prisma.space.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { displayName: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [
          { subscriberCount: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          name: true,
          displayName: true,
          description: true,
          subscriberCount: true,
          isNsfw: true,
          createdAt: true,
        },
      });
    }

    // Search users
    if (type === 'all' || type === 'users') {
      results.users = await prisma.user.findMany({
        where: {
          username: { contains: searchTerm, mode: 'insensitive' },
        },
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          bio: true,
          createdAt: true,
        },
      });

      // Calculate karma for each user
      for (const user of results.users) {
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

        user.karma = (postKarma._sum.voteScore || 0) + (commentKarma._sum.voteScore || 0);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
