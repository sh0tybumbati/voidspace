import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    emailVerified: boolean;
  };
}

type Failure = { status: 401 | 403; message: string };

/**
 * Work out who is calling. The token only proves who they were when it was issued, so the account is
 * loaded from the database on every request: a ban, a demotion or a password reset takes effect at once.
 */
async function authenticate(req: AuthRequest): Promise<AuthRequest['user'] | Failure | null> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');

  let decoded: { userId?: string; iat?: number };
  try {
    decoded = jwt.verify(header.substring(7), secret) as { userId?: string; iat?: number };
  } catch (err) {
    return { status: 401, message: err instanceof jwt.TokenExpiredError ? 'Your session expired. Sign in again.' : 'Invalid token' };
  }
  if (!decoded.userId) return { status: 401, message: 'Invalid token' };

  const account = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, username: true, email: true, isAdmin: true, banned: true, passwordChangedAt: true, emailVerifiedAt: true },
  });
  if (!account) return { status: 401, message: 'That account no longer exists.' };
  // Token times are whole seconds, so compare in seconds: anything issued before the change's second is out.
  if (account.passwordChangedAt && (decoded.iat ?? 0) < Math.floor(account.passwordChangedAt.getTime() / 1000)) {
    return { status: 401, message: 'Your password was changed. Sign in again.' };
  }
  if (account.banned) return { status: 403, message: 'This account is banned.' };
  return { id: account.id, username: account.username, email: account.email, isAdmin: account.isAdmin, emailVerified: Boolean(account.emailVerifiedAt) };
}

const isFailure = (r: AuthRequest['user'] | Failure | null): r is Failure => Boolean(r && 'status' in r);

/** Requires a signed-in, current, non-banned account. */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authenticate(req);
    if (!result) { res.status(401).json({ error: 'Unauthorized', message: 'No token provided' }); return; }
    if (isFailure(result)) { res.status(result.status).json({ error: result.status === 401 ? 'Unauthorized' : 'Forbidden', message: result.message }); return; }
    req.userId = result.id;
    req.user = result;
    next();
  } catch (error) {
    next(error);
  }
};

/** Identifies the caller if they are signed in; carries on anonymously otherwise (including for banned accounts). */
export const optionalAuthMiddleware = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authenticate(req);
    if (result && !isFailure(result)) { req.userId = result.id; req.user = result; }
  } catch {
    // treat any failure as signed out
  }
  next();
};

/** Requires a signed-in account that is an admin right now (not just when the token was issued). */
export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  await authMiddleware(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!req.user?.isAdmin) { res.status(403).json({ error: 'Forbidden', message: 'Admin access required' }); return; }
    next();
  });
};

/**
 * When REQUIRE_EMAIL_VERIFICATION=1, writing (posting, commenting, reporting...) needs a verified email.
 * Off by default so a local install works without a mail server.
 */
export const verifiedMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (process.env.REQUIRE_EMAIL_VERIFICATION === '1' && !req.user?.emailVerified) {
    res.status(403).json({ error: 'Forbidden', code: 'email_unverified', message: 'Verify your email address to do that. Check your inbox for the link.' });
    return;
  }
  next();
};
