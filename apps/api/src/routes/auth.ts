import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res: Response) => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body);
    const { username, email, password } = validatedData;

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (existingUsername) {
      res.status(400).json({ error: 'Username already taken' });
      return;
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingEmail) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash,
        alignment: 0,
        isAdmin: false,
        isOver18: false,
        banned: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        alignment: true,
      },
    });

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      jwtSecret,
      { expiresIn: (process.env.JWT_EXPIRY || '7d') as jwt.SignOptions['expiresIn'] }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req, res: Response) => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body);
    const { username, password } = validatedData;

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        alignment: true,
        avatarUrl: true,
        isAdmin: true,
        banned: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Check if user is banned
    if (user.banned) {
      res.status(403).json({ error: 'Account is banned' });
      return;
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, isAdmin: user.isAdmin },
      jwtSecret,
      { expiresIn: (process.env.JWT_EXPIRY || '7d') as jwt.SignOptions['expiresIn'] }
    );

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, backend just confirms)
 */
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  // JWT tokens are stateless, so we just return success
  // Client should remove token from storage
  res.json({ message: 'Logout successful' });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        alignment: true,
        avatarUrl: true,
        bio: true,
        preferences: true,
        isAdmin: true,
        isOver18: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify-age
 * Verify user is over 18 (for NSFW content)
 */
router.post('/verify-age', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { isOver18: true },
    });

    res.json({ message: 'Age verified successfully' });
  } catch (error) {
    console.error('Verify age error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/auth/password
 * Change password
 */
router.patch('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const passwordChangeSchema = z.object({
      currentPassword: z.string(),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be less than 100 characters'),
    });

    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { passwordHash: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: req.userId },
      data: { passwordHash: newPasswordHash },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }

    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
