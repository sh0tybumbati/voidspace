import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db';

export type TokenType = 'verify_email' | 'reset_password';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Create a one-time token. Only its hash is stored, so a database leak does not leak working links. */
export async function createAuthToken(userId: string, type: TokenType, ttlMs: number): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  await prisma.authToken.create({ data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

/** Look up whose token this is without using it up (for checks that must pass before it is spent). */
export async function peekAuthToken(raw: string, type: TokenType): Promise<string | null> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(raw) } });
  return row && row.type === type && !row.usedAt && row.expiresAt >= new Date() ? row.userId : null;
}

/** Use a token once. Returns the user it belongs to, or null if it is wrong, used or expired. */
export async function consumeAuthToken(raw: string, type: TokenType): Promise<string | null> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  // updateMany with usedAt: null makes the claim atomic if two requests race.
  const claimed = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? row.userId : null;
}

export async function recentTokenCount(userId: string, type: TokenType, withinMs: number): Promise<number> {
  return prisma.authToken.count({ where: { userId, type, createdAt: { gt: new Date(Date.now() - withinMs) } } });
}
