import { prisma } from '../db';
import { conflict, notFound } from '../lib/http';
import { notify } from './notify';

/** Admin actions are public. Every one needs a justification, and every one is written here. */
export async function logAdminAction(adminId: string, actionType: string, targetId: string, targetType: string, justification: string, evidence?: string) {
  return prisma.adminAction.create({ data: { adminId, actionType, targetId, targetType, justification, evidence: evidence ?? null } });
}

/** Remove content as a site admin (for example an illegal post). Logged publicly with a justification. */
export async function adminRemoveContent(adminId: string, targetType: 'post' | 'comment', targetId: string, justification: string) {
  const data = { removed: true, removedBy: adminId, removalReason: `Removed by site admin: ${justification}` };
  let authorId: string;
  if (targetType === 'post') {
    const post = await prisma.post.findUnique({ where: { id: targetId } });
    if (!post) throw notFound('Post not found.');
    if (post.removed) throw conflict('That has already been removed.');
    authorId = post.authorId;
    await prisma.post.update({ where: { id: targetId }, data });
  } else {
    const comment = await prisma.comment.findUnique({ where: { id: targetId } });
    if (!comment) throw notFound('Comment not found.');
    if (comment.removed) throw conflict('That has already been removed.');
    authorId = comment.authorId;
    await prisma.comment.update({ where: { id: targetId }, data });
  }
  const action = await logAdminAction(adminId, `remove_${targetType}`, targetId, targetType, justification);
  await notify(authorId, { type: 'content_removed_admin', title: `Your ${targetType} was removed by a site admin`, body: justification, link: '/transparency' });
  return action;
}
