import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { HttpError } from '../lib/http';
import { sendMail } from '../lib/mailer';
import { getStorage } from '../lib/storage';

/** Deleted accounts keep their row (so public logs and threads stay intact) under a name like this. */
export const DELETED_PREFIX = 'deleted_';

export interface DeletionCheck {
  /** Reasons the account cannot be deleted yet. Empty means go ahead. */
  blockers: string[];
  /** Spaces nobody else belongs to, which will be closed along with the account. */
  willClose: string[];
  /** Spaces where the person just stops being a moderator. */
  stepDownFrom: string[];
  counts: { posts: number; comments: number; uploads: number };
}

export async function deletionCheck(userId: string): Promise<DeletionCheck> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new HttpError(404, 'That account no longer exists.');

  const blockers: string[] = [];
  const willClose: string[] = [];
  const stepDownFrom: string[] = [];
  if (user.isAdmin) blockers.push('You are a site admin. Another admin has to remove your admin role first, so the site is never left without one.');

  const roles = await prisma.moderator.findMany({ where: { userId }, include: { space: { select: { id: true, name: true, deletedAt: true } } } });
  for (const role of roles) {
    if (role.space.deletedAt) continue;
    const [otherMods, otherMembers] = await Promise.all([
      prisma.moderator.count({ where: { spaceId: role.spaceId, userId: { not: userId } } }),
      prisma.subscription.count({ where: { spaceId: role.spaceId, userId: { not: userId } } }),
    ]);
    if (otherMods > 0) stepDownFrom.push(role.space.name);
    else if (otherMembers > 0) blockers.push(`You are the only moderator of v/${role.space.name}, which has ${otherMembers} other ${otherMembers === 1 ? 'member' : 'members'}. A space must keep a moderator: get a successor elected first, or have the members vote to delete the space.`);
    else willClose.push(role.space.name);
  }

  const [posts, comments, uploads] = await Promise.all([
    prisma.post.count({ where: { authorId: userId } }),
    prisma.comment.count({ where: { authorId: userId } }),
    prisma.upload.count({ where: { userId } }),
  ]);
  return { blockers, willClose, stepDownFrom, counts: { posts, comments, uploads } };
}

/** Is any live content still pointing at this stored image? */
async function stillReferenced(url: string): Promise<boolean> {
  const [post, comment, avatar, icon, banner] = await Promise.all([
    prisma.post.findFirst({ where: { url }, select: { id: true } }),
    prisma.comment.findFirst({ where: { imageUrl: url }, select: { id: true } }),
    prisma.user.findFirst({ where: { avatarUrl: url }, select: { id: true } }),
    prisma.space.findFirst({ where: { iconUrl: url }, select: { id: true } }),
    prisma.space.findFirst({ where: { bannerUrl: url }, select: { id: true } }),
  ]);
  return Boolean(post || comment || avatar || icon || banner);
}

/**
 * Delete an account. The row is anonymised rather than removed: moderation logs, election tallies and
 * threads other people replied to must keep making sense, so they point at "deleted_xxxx" instead.
 * Everything personal goes: email, password, bio, picture, sessions, saved items, votes cast, notifications.
 * With `deleteContent`, the person's posts and comments are blanked and their uploaded images removed too.
 */
export async function deleteAccount(userId: string, opts: { deleteContent: boolean }): Promise<void> {
  const check = await deletionCheck(userId);
  if (check.blockers.length) throw new HttpError(409, check.blockers.join(' '), 'deletion_blocked');

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const now = new Date();
  const tombstone = `${DELETED_PREFIX}${randomBytes(4).toString('hex')}`;
  const orphanedUploads: { storageKey: string; url: string }[] = [];

  await prisma.$transaction(async (tx) => {
    if (check.willClose.length) await tx.space.updateMany({ where: { name: { in: check.willClose } }, data: { deletedAt: now } });
    await tx.modElection.updateMany({ where: { candidateId: userId, status: 'active' }, data: { status: 'withdrawn', closedAt: now } });
    await tx.moderator.deleteMany({ where: { userId } });

    const subs = await tx.subscription.findMany({ where: { userId }, select: { spaceId: true } });
    for (const { spaceId } of subs) await tx.space.update({ where: { id: spaceId }, data: { subscriberCount: { decrement: 1 } } });
    await tx.subscription.deleteMany({ where: { userId } });

    await tx.vote.deleteMany({ where: { userId } });
    await tx.savedPost.deleteMany({ where: { userId } });
    await tx.savedComment.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.authToken.deleteMany({ where: { userId } });

    if (opts.deleteContent) {
      await tx.post.updateMany({ where: { authorId: userId }, data: { title: '[deleted]', content: null, url: null, postType: 'text', flairId: null } });
      await tx.comment.updateMany({ where: { authorId: userId }, data: { content: '[deleted by author]', imageUrl: null } });
      orphanedUploads.push(...(await tx.upload.findMany({ where: { userId }, select: { storageKey: true, url: true } })));
      await tx.upload.deleteMany({ where: { userId } });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        username: tombstone,
        email: `${tombstone}@deleted.invalid`,
        passwordHash: `!${randomBytes(24).toString('hex')}`,   // not a valid hash, so nothing can ever match it
        bio: null, avatarUrl: null, preferences: Prisma.JsonNull,
        isAdmin: false, emailVerifiedAt: null, passwordChangedAt: now, deletedAt: now,
      },
    });
  });

  // Files go after the database commit, and only when nothing else still shows them.
  const storage = getStorage();
  await Promise.all(orphanedUploads.map(async (u) => {
    if (await stillReferenced(u.url)) return;
    try { await storage.remove(u.storageKey); } catch (e) { console.error('Could not remove an uploaded file:', u.storageKey, e); }
  }));

  await sendMail({
    to: user.email,
    subject: 'Your Voidspace account was deleted',
    text: `Hello ${user.username},\n\nYour Voidspace account has been deleted${opts.deleteContent ? ', along with the text of your posts and comments and your uploaded images' : ''}. Your email address, password and profile were removed from our records.\n\nPosts and comments you chose to leave now show as "[deleted]". Moderation decisions that involved you stay in the public log under an anonymous name.\n\nIf you did not do this, reply to this email straight away.\n`,
  }).catch((e) => console.error('Could not send the deletion email:', e));
}
