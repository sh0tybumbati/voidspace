import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

/**
 * Which spaces a viewer may see. Deleted spaces are gone for everyone. Private spaces are visible only to
 * their subscribers and moderators.
 */
export function visibleSpaceWhere(userId?: string): Prisma.SpaceWhereInput {
  return {
    deletedAt: null,
    OR: [
      { isPrivate: false },
      ...(userId ? [{ subscriptions: { some: { userId } } }, { moderators: { some: { userId } } }] : []),
    ],
  };
}

interface SpaceLike { id: string; isPrivate: boolean; deletedAt: Date | null }

export async function canViewSpace(space: SpaceLike, userId?: string): Promise<boolean> {
  if (space.deletedAt) return false;
  if (!space.isPrivate) return true;
  if (!userId) return false;
  const [sub, mod] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId_spaceId: { userId, spaceId: space.id } } }),
    prisma.moderator.findUnique({ where: { userId_spaceId: { userId, spaceId: space.id } } }),
  ]);
  return Boolean(sub || mod);
}

export async function canViewSpaceById(spaceId: string, userId?: string): Promise<boolean> {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { id: true, isPrivate: true, deletedAt: true } });
  return space ? canViewSpace(space, userId) : false;
}
