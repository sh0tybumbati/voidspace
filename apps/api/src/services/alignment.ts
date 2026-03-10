import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calculate alignment score for a user
 * Alignment = sum of vote scores from all non-removed posts + comments
 *
 * @param userId - The user ID to calculate alignment for
 * @returns The total alignment score
 */
export const calculateAlignment = async (userId: string): Promise<number> => {
  try {
    // Get aggregate post scores
    const postAlignment = await prisma.post.aggregate({
      where: {
        authorId: userId,
        removed: false,
      },
      _sum: {
        voteScore: true,
      },
    });

    // Get aggregate comment scores
    const commentAlignment = await prisma.comment.aggregate({
      where: {
        authorId: userId,
        removed: false,
      },
      _sum: {
        voteScore: true,
      },
    });

    const totalAlignment =
      (postAlignment._sum.voteScore || 0) + (commentAlignment._sum.voteScore || 0);

    // Update user's alignment score in database
    await prisma.user.update({
      where: { id: userId },
      data: { alignment: totalAlignment },
    });

    return totalAlignment;
  } catch (error) {
    console.error('Calculate alignment error:', error);
    throw error;
  }
};

/**
 * Calculate space-specific alignment for a user
 * Used for mod election eligibility
 *
 * @param userId - The user ID
 * @param spaceId - The space ID
 * @returns The alignment score within that specific space
 */
export const calculateSpaceAlignment = async (
  userId: string,
  spaceId: string
): Promise<number> => {
  try {
    // Get post scores in this space
    const postAlignment = await prisma.post.aggregate({
      where: {
        authorId: userId,
        spaceId: spaceId,
        removed: false,
      },
      _sum: {
        voteScore: true,
      },
    });

    // Get comment scores in this space
    // Need to join through posts to get space
    const commentAlignment = await prisma.comment.aggregate({
      where: {
        authorId: userId,
        removed: false,
        post: {
          spaceId: spaceId,
        },
      },
      _sum: {
        voteScore: true,
      },
    });

    const spaceAlignment =
      (postAlignment._sum.voteScore || 0) + (commentAlignment._sum.voteScore || 0);

    return spaceAlignment;
  } catch (error) {
    console.error('Calculate space alignment error:', error);
    throw error;
  }
};

/**
 * Calculate alignment for all users
 * Used in background job
 */
export const calculateAllUserAlignments = async (): Promise<void> => {
  try {
    console.log('Starting alignment calculation for all users...');

    // Get all user IDs
    const users = await prisma.user.findMany({
      select: { id: true, username: true },
    });

    let updated = 0;
    for (const user of users) {
      try {
        await calculateAlignment(user.id);
        updated++;
      } catch (error) {
        console.error(`Failed to update alignment for user ${user.username}:`, error);
      }
    }

    console.log(`Alignment calculation complete. Updated ${updated}/${users.length} users.`);
  } catch (error) {
    console.error('Calculate all alignments error:', error);
    throw error;
  }
};

/**
 * Get alignment statistics for a user
 * Provides breakdown of post vs comment alignment
 */
export const getAlignmentBreakdown = async (
  userId: string
): Promise<{
  totalAlignment: number;
  postAlignment: number;
  commentAlignment: number;
  postCount: number;
  commentCount: number;
}> => {
  try {
    const [postStats, commentStats] = await Promise.all([
      prisma.post.aggregate({
        where: {
          authorId: userId,
          removed: false,
        },
        _sum: { voteScore: true },
        _count: true,
      }),
      prisma.comment.aggregate({
        where: {
          authorId: userId,
          removed: false,
        },
        _sum: { voteScore: true },
        _count: true,
      }),
    ]);

    const postAlignment = postStats._sum.voteScore || 0;
    const commentAlignment = commentStats._sum.voteScore || 0;

    return {
      totalAlignment: postAlignment + commentAlignment,
      postAlignment,
      commentAlignment,
      postCount: postStats._count,
      commentCount: commentStats._count,
    };
  } catch (error) {
    console.error('Get alignment breakdown error:', error);
    throw error;
  }
};

/**
 * Get space-specific alignment statistics for a user
 * Used for citizenship eligibility, mod elections, and user profiles filtered by space
 */
export const getSpaceAlignmentBreakdown = async (
  userId: string,
  spaceId: string
): Promise<{
  spaceAlignment: number;
  postAlignment: number;
  commentAlignment: number;
  postCount: number;
  commentCount: number;
}> => {
  try {
    const [postStats, commentStats] = await Promise.all([
      prisma.post.aggregate({
        where: {
          authorId: userId,
          spaceId: spaceId,
          removed: false,
        },
        _sum: { voteScore: true },
        _count: true,
      }),
      prisma.comment.aggregate({
        where: {
          authorId: userId,
          removed: false,
          post: {
            spaceId: spaceId,
          },
        },
        _sum: { voteScore: true },
        _count: true,
      }),
    ]);

    const postAlignment = postStats._sum.voteScore || 0;
    const commentAlignment = commentStats._sum.voteScore || 0;

    return {
      spaceAlignment: postAlignment + commentAlignment,
      postAlignment,
      commentAlignment,
      postCount: postStats._count,
      commentCount: commentStats._count,
    };
  } catch (error) {
    console.error('Get space alignment breakdown error:', error);
    throw error;
  }
};
