import type { Moderator } from '@prisma/client';
import { prisma } from '../db';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../lib/http';
import { hasModPermission } from '../utils/permissions';
import { notify } from './notify';

/** What an elected moderator can do. Founders get { all: true } when they create a space. */
export const DEFAULT_MOD_PERMISSIONS = {
  remove_posts: true,
  remove_comments: true,
  ban_users: true,
  edit_rules: true,
  manage_flairs: true,
  pin_posts: true,
};

export const APPEAL_WINDOW_DAYS = 30;

export async function getModerator(userId: string, spaceId: string): Promise<Moderator | null> {
  return prisma.moderator.findUnique({ where: { userId_spaceId: { userId, spaceId } } });
}

/** Throws 403 unless the user is a moderator of the space (with the given permission, if any). */
export async function requireModerator(userId: string, spaceId: string, permission?: string): Promise<Moderator> {
  const mod = await getModerator(userId, spaceId);
  if (!mod || (permission && !hasModPermission(mod.permissions, permission))) throw forbidden('You must be a moderator of this space.');
  return mod;
}

type Target = 'post' | 'comment';

async function loadTarget(targetType: Target, id: string) {
  if (targetType === 'post') {
    const post = await prisma.post.findUnique({ where: { id }, include: { space: true } });
    if (!post) throw notFound('Post not found.');
    return { spaceId: post.spaceId, spaceName: post.space.name, authorId: post.authorId, removed: post.removed, label: post.title };
  }
  const comment = await prisma.comment.findUnique({ where: { id }, include: { post: { include: { space: true } } } });
  if (!comment) throw notFound('Comment not found.');
  return { spaceId: comment.post.spaceId, spaceName: comment.post.space.name, authorId: comment.authorId, removed: comment.removed, label: comment.content.slice(0, 80) };
}

/** Remove a post or comment. Always logged publicly, always with a reason, and the author is told how to appeal. */
export async function removeContent(actorId: string, targetType: Target, targetId: string, reason: string) {
  const t = await loadTarget(targetType, targetId);
  await requireModerator(actorId, t.spaceId, targetType === 'post' ? 'remove_posts' : 'remove_comments');
  if (t.removed) throw conflict('That has already been removed.');

  const data = { removed: true, removedBy: actorId, removalReason: reason };
  if (targetType === 'post') await prisma.post.update({ where: { id: targetId }, data: { ...data, isPinned: false, pinnedAt: null } });   // a removed post gives up its pin
  else await prisma.comment.update({ where: { id: targetId }, data });

  const action = await prisma.modAction.create({
    data: { modId: actorId, spaceId: t.spaceId, actionType: `remove_${targetType}`, targetId, targetType, reason },
  });
  if (t.authorId !== actorId) {
    await notify(t.authorId, {
      type: 'content_removed',
      title: `Your ${targetType} in v/${t.spaceName} was removed`,
      body: reason,
      link: `/appeals/new?action=${action.id}`,
      data: { modActionId: action.id, spaceName: t.spaceName },
    });
  }
  return { action, spaceId: t.spaceId, authorId: t.authorId };
}

/** Put removed content back. `viaAppeal` skips the permission check because an appeal reviewer is authorised separately. */
export async function restoreContent(actorId: string, targetType: Target, targetId: string, reason = 'Restored by a moderator', opts: { skipAuth?: boolean } = {}) {
  const t = await loadTarget(targetType, targetId);
  if (!opts.skipAuth) await requireModerator(actorId, t.spaceId);
  if (!t.removed) throw conflict('That has not been removed.');

  const data = { removed: false, removedBy: null, removalReason: null };
  if (targetType === 'post') await prisma.post.update({ where: { id: targetId }, data });
  else await prisma.comment.update({ where: { id: targetId }, data });

  const action = await prisma.modAction.create({
    data: { modId: actorId, spaceId: t.spaceId, actionType: `restore_${targetType}`, targetId, targetType, reason },
  });
  if (t.authorId !== actorId) {
    await notify(t.authorId, { type: 'content_restored', title: `Your ${targetType} in v/${t.spaceName} was restored`, body: reason, link: `/v/${t.spaceName}` });
  }
  return action;
}

export async function banUser(actorId: string, spaceId: string, userId: string, reason: string, durationDays?: number) {
  await requireModerator(actorId, spaceId, 'ban_users');
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) throw notFound('Space not found.');
  if (await getModerator(userId, spaceId)) throw badRequest('Cannot ban a moderator. Remove them as mod first.');
  if (await prisma.ban.findFirst({ where: { userId, spaceId, isActive: true } })) throw badRequest('User is already banned from this space');

  const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86_400_000) : null;
  const ban = await prisma.ban.create({ data: { userId, spaceId, bannedBy: actorId, reason, expiresAt, isActive: true } });
  const action = await prisma.modAction.create({
    data: { modId: actorId, spaceId, actionType: 'ban_user', targetId: userId, targetType: 'user', reason: `Banned ${durationDays ? `for ${durationDays} days` : 'permanently'}: ${reason}` },
  });
  await notify(userId, {
    type: 'banned',
    title: `You were banned from v/${space.name}`,
    body: reason,
    link: `/appeals/new?action=${action.id}`,
    data: { modActionId: action.id, spaceName: space.name },
  });
  return { ban, action };
}

export async function unbanUser(actorId: string, spaceId: string, userId: string, reason = 'User unbanned', opts: { skipAuth?: boolean } = {}) {
  if (!opts.skipAuth) await requireModerator(actorId, spaceId, 'ban_users');
  const ban = await prisma.ban.findFirst({ where: { userId, spaceId, isActive: true } });
  if (!ban) throw notFound('No active ban found for this user');
  await prisma.ban.update({ where: { id: ban.id }, data: { isActive: false } });
  const action = await prisma.modAction.create({ data: { modId: actorId, spaceId, actionType: 'unban_user', targetId: userId, targetType: 'user', reason } });
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  await notify(userId, { type: 'unbanned', title: `Your ban from v/${space?.name ?? 'a space'} was lifted`, body: reason });
  return action;
}

/** Mark a moderation action as reversed (an approved appeal) so the public log shows it. */
export async function markReversed(modActionId: string, byUserId: string) {
  await prisma.modAction.update({ where: { id: modActionId }, data: { reversedBy: byUserId, reversedAt: new Date() } });
}

export { HttpError };

// ---------------------------------------------------------------------------------------------
// Pinned posts: a small, fixed number of slots at the top of a space, set by moderators and logged.
// ---------------------------------------------------------------------------------------------

export const MAX_PINS = 2;

/** Pinning needs `pin_posts`, or the general content permission `remove_posts` (so existing moderators keep working). */
async function requirePinner(userId: string, spaceId: string): Promise<void> {
  const mod = await getModerator(userId, spaceId);
  if (!mod || !(hasModPermission(mod.permissions, 'pin_posts') || hasModPermission(mod.permissions, 'remove_posts'))) throw forbidden('You must be a moderator of this space to pin posts.');
}

/**
 * Pin a post to the top of its space. If every slot is taken, name one to replace with `replacePostId`;
 * otherwise the caller gets a 409 that says which posts hold the slots.
 */
export async function pinPost(actorId: string, postId: string, opts: { reason?: string; replacePostId?: string } = {}) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { space: true } });
  if (!post) throw notFound('Post not found.');
  await requirePinner(actorId, post.spaceId);
  if (post.removed) throw badRequest('A removed post cannot be pinned.');
  if (post.isPinned) throw conflict('That post is already pinned.');

  const pinned = await prisma.post.findMany({ where: { spaceId: post.spaceId, isPinned: true, removed: false }, orderBy: { pinnedAt: 'asc' }, select: { id: true, title: true } });
  let replaced: { id: string; title: string } | undefined;
  if (pinned.length >= MAX_PINS) {
    if (!opts.replacePostId) throw new HttpError(409, `This space already has ${MAX_PINS} pinned posts (${pinned.map((p) => `"${p.title}"`).join(' and ')}). Unpin one, or choose one to replace.`, 'pins_full');
    replaced = pinned.find((p) => p.id === opts.replacePostId);
    if (!replaced) throw badRequest('That post is not one of the pinned posts.');
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (replaced) {
      await tx.post.update({ where: { id: replaced.id }, data: { isPinned: false, pinnedAt: null } });
      await tx.modAction.create({ data: { modId: actorId, spaceId: post.spaceId, actionType: 'unpin_post', targetId: replaced.id, targetType: 'post', reason: `Replaced by another pinned post: "${post.title.slice(0, 120)}".` } });
    }
    await tx.post.update({ where: { id: post.id }, data: { isPinned: true, pinnedAt: now } });
    await tx.modAction.create({ data: { modId: actorId, spaceId: post.spaceId, actionType: 'pin_post', targetId: post.id, targetType: 'post', reason: opts.reason?.trim() || 'Pinned to the top of the space.' } });
  });
  if (post.authorId !== actorId) {
    await notify(post.authorId, { type: 'post_pinned', title: `Your post in v/${post.space.name} was pinned`, body: post.title, link: `/v/${post.space.name}/${post.id}` });
  }
  return { replacedPostId: replaced?.id ?? null };
}

export async function unpinPost(actorId: string, postId: string, reason?: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound('Post not found.');
  await requirePinner(actorId, post.spaceId);
  if (!post.isPinned) throw conflict('That post is not pinned.');
  await prisma.$transaction([
    prisma.post.update({ where: { id: post.id }, data: { isPinned: false, pinnedAt: null } }),
    prisma.modAction.create({ data: { modId: actorId, spaceId: post.spaceId, actionType: 'unpin_post', targetId: post.id, targetType: 'post', reason: reason?.trim() || 'Unpinned.' } }),
  ]);
}
