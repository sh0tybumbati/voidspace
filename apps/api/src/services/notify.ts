import { prisma } from '../db';
import { publish } from '../lib/bus';

export interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
}

/** Create a notification for one or more users and push it to anyone connected to the live stream. */
export async function notify(userIds: string | string[], input: NotificationInput): Promise<void> {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (!ids.length) return;
  for (const userId of ids) {
    const row = await prisma.notification.create({
      data: { userId, type: input.type, title: input.title, body: input.body ?? null, link: input.link ?? null, data: (input.data ?? undefined) as object | undefined },
    });
    publish(`user:${userId}`, 'notification', { id: row.id, type: row.type, title: row.title, body: row.body, link: row.link, createdAt: row.createdAt });
  }
}

/** Notify every moderator of a space, optionally leaving one person out (usually the one who caused it). */
export async function notifyModerators(spaceId: string, input: NotificationInput, exceptUserId?: string): Promise<void> {
  const mods = await prisma.moderator.findMany({ where: { spaceId }, select: { userId: true } });
  await notify(mods.map((m) => m.userId).filter((id) => id !== exceptUserId), input);
}

export async function notifyAdmins(input: NotificationInput): Promise<void> {
  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  await notify(admins.map((a) => a.id), input);
}
