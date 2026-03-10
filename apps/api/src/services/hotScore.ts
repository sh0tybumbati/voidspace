import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Reddit's hot ranking algorithm
 *
 * Hot score = log10(max(|score|, 1)) * sign(score) + (age_in_seconds / 45000)
 *
 * Where:
 * - score is the vote score (upvotes - downvotes)
 * - sign(score) is 1 if positive, -1 if negative, 0 if zero
 * - age_in_seconds is seconds since epoch
 * - 45000 seconds = 12.5 hours (so posts decay over time)
 */
function calculateHotScore(voteScore: number, createdAt: Date): number {
  const score = Math.abs(voteScore);
  const order = Math.log10(Math.max(score, 1));
  const sign = voteScore > 0 ? 1 : voteScore < 0 ? -1 : 0;
  const seconds = Math.floor(createdAt.getTime() / 1000);

  return order * sign + seconds / 45000;
}

/**
 * Update hot score for a single post
 */
export async function updatePostHotScore(postId: string): Promise<number> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      voteScore: true,
      createdAt: true,
    },
  });

  if (!post) {
    throw new Error('Post not found');
  }

  const hotScore = calculateHotScore(post.voteScore, post.createdAt);

  await prisma.post.update({
    where: { id: postId },
    data: { hotScore },
  });

  return hotScore;
}

/**
 * Update hot scores for all posts
 * This should be run periodically (e.g., every 15 minutes)
 */
export async function updateAllPostHotScores(): Promise<void> {
  console.log('Starting hot score update for all posts...');

  const posts = await prisma.post.findMany({
    where: {
      removed: false,
    },
    select: {
      id: true,
      voteScore: true,
      createdAt: true,
    },
  });

  let updated = 0;
  for (const post of posts) {
    const hotScore = calculateHotScore(post.voteScore, post.createdAt);

    await prisma.post.update({
      where: { id: post.id },
      data: { hotScore },
    });

    updated++;
  }

  console.log(`Hot score update complete. Updated ${updated}/${posts.length} posts.`);
}

/**
 * Update hot scores for posts in a specific space
 */
export async function updateSpaceHotScores(spaceId: string): Promise<void> {
  const posts = await prisma.post.findMany({
    where: {
      spaceId,
      removed: false,
    },
    select: {
      id: true,
      voteScore: true,
      createdAt: true,
    },
  });

  for (const post of posts) {
    const hotScore = calculateHotScore(post.voteScore, post.createdAt);

    await prisma.post.update({
      where: { id: post.id },
      data: { hotScore },
    });
  }

  console.log(`Updated hot scores for ${posts.length} posts in space ${spaceId}`);
}

/**
 * Update hot score immediately after a vote
 * This is optional - can rely on periodic updates instead
 */
export async function updateHotScoreAfterVote(postId: string): Promise<void> {
  await updatePostHotScore(postId);
}
