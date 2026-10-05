import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { HttpError, badRequest, handler } from '../lib/http';
import { sendMail, webUrl } from '../lib/mailer';
import { checkPasswordStrength } from '../lib/passwords';
import { consumeAuthToken, createAuthToken, peekAuthToken, recentTokenCount } from '../lib/tokens';

const router = Router();
const HOUR = 3_600_000;

export async function sendVerificationEmail(user: { id: string; email: string; username: string }): Promise<void> {
  const token = await createAuthToken(user.id, 'verify_email', 48 * HOUR);
  await sendMail({
    to: user.email,
    subject: 'Verify your Voidspace email',
    text: `Hi ${user.username},\n\nConfirm your email address to start posting:\n\n${webUrl()}/verify-email?token=${token}\n\nThe link works for 48 hours. If you did not sign up, ignore this email.\n`,
  });
}

/** POST /api/auth/verify-email */
router.post('/verify-email', handler(async (req, res) => {
  const { token } = z.object({ token: z.string().min(10).max(200) }).parse(req.body);
  const userId = await consumeAuthToken(token, 'verify_email');
  if (!userId) throw badRequest('That verification link is invalid or has expired. Request a new one.');
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  res.json({ message: 'Your email address is verified.' });
}));

/** POST /api/auth/resend-verification */
router.post('/resend-verification', authMiddleware, handler<AuthRequest>(async (req, res) => {
  if (req.user!.emailVerified) throw badRequest('Your email is already verified.');
  if ((await recentTokenCount(req.userId!, 'verify_email', HOUR)) >= 3) throw new HttpError(429, 'You asked for several links already. Check your inbox, or try again in an hour.');
  await sendVerificationEmail({ id: req.userId!, email: req.user!.email, username: req.user!.username });
  res.json({ message: 'Sent. Check your inbox.' });
}));

/**
 * POST /api/auth/forgot-password
 * Always answers the same way, so it cannot be used to find out which emails have accounts.
 */
router.post('/forgot-password', handler(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user && !user.banned && (await recentTokenCount(user.id, 'reset_password', HOUR)) < 3) {
    const token = await createAuthToken(user.id, 'reset_password', HOUR);
    await sendMail({
      to: user.email,
      subject: 'Reset your Voidspace password',
      text: `Hi ${user.username},\n\nSomeone (hopefully you) asked to reset your password:\n\n${webUrl()}/reset-password?token=${token}\n\nThe link works for one hour and only once. If it was not you, you can ignore this email.\n`,
    });
  }
  res.json({ message: 'If that email has an account, a reset link is on its way.' });
}));

/** POST /api/auth/reset-password */
router.post('/reset-password', handler(async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(10).max(200), password: z.string().max(100) }).parse(req.body);
  const owner = await peekAuthToken(token, 'reset_password');
  if (!owner) throw badRequest('That reset link is invalid or has expired. Request a new one.');
  const user = await prisma.user.findUniqueOrThrow({ where: { id: owner } });
  // Check the password before spending the link, so a weak choice does not cost them the token.
  const weak = checkPasswordStrength(password, { username: user.username, email: user.email });
  if (weak) throw badRequest(weak);
  if ((await consumeAuthToken(token, 'reset_password')) !== owner) throw badRequest('That reset link was already used.');
  await prisma.user.update({ where: { id: owner }, data: { passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: new Date() } });
  await prisma.authToken.updateMany({ where: { userId: owner, type: 'reset_password', usedAt: null }, data: { usedAt: new Date() } });
  res.json({ message: 'Your password was changed. Sign in with the new one.' });
}));

export default router;
