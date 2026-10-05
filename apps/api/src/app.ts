import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import spaceRoutes from './routes/spaces';
import postRoutes from './routes/posts';
import commentRoutes from './routes/comments';
import moderationRoutes from './routes/moderation';
import searchRoutes from './routes/search';
import adminRoutes from './routes/admin';
import reportRoutes from './routes/reports';
import appealRoutes from './routes/appeals';
import modQueueRoutes from './routes/modqueue';
import governanceRoutes from './routes/governance';
import transparencyRoutes from './routes/transparency';
import adminGovernanceRoutes from './routes/adminGovernance';
import notificationRoutes from './routes/notifications';
import streamRoutes from './routes/stream';
import accountRoutes from './routes/account';
import accountSecurityRoutes from './routes/accountSecurity';
import uploadRoutes from './routes/uploads';
import { s3Configured, uploadDir } from './lib/storage';
import { errorMiddleware } from './lib/http';

// Origins that may call the API from a browser.
// FRONTEND_URL may list several origins, comma separated. Set ALLOW_LAN_ORIGINS=1 to also accept
// the page being opened by IP address or hostname on this machine's own network (for example
// from a phone), which is how a home or office install is usually used.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean);
const frontendPorts = new Set(allowedOrigins.map((o) => { try { return new URL(o).port; } catch { return ''; } }));
const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin or non-browser requests
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.ALLOW_LAN_ORIGINS !== '1') return false;
  try {
    const u = new URL(origin);
    return PRIVATE_HOST.test(u.hostname) && frontendPorts.has(u.port);
  } catch {
    return false;
  }
}


/** A limiter that tests can switch off with RATE_LIMIT_DISABLED=1 (checked per request). */
const limiter = (opts: { windowMs: number; limit: number; skipSuccessfulRequests?: boolean; message: string }) =>
  rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    skipSuccessfulRequests: opts.skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.RATE_LIMIT_DISABLED === '1',
    handler: (_req, res) => { res.status(429).json({ error: 'Too Many Requests', message: opts.message }); },
  });

export function createApp(): express.Express {
  const app = express();
  // Behind a tunnel or reverse proxy, TRUST_PROXY (usually 1) lets rate limits see the visitor, not the proxy.
  if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY === 'true');
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, originAllowed(origin)),
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Limits, per visitor address. Generous for normal use, tight where abuse is likely.
  app.use('/api', limiter({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 300, message: 'You are making requests very quickly. Slow down for a moment.' }));
  app.use('/api/auth/login', limiter({ windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true, message: 'Too many sign-in attempts. Try again in a few minutes.' }));
  app.use('/api/auth/register', limiter({ windowMs: 60 * 60_000, limit: 10, message: 'Too many accounts created from this address. Try again later.' }));
  app.use(['/api/auth/forgot-password', '/api/auth/resend-verification'], limiter({ windowMs: 60 * 60_000, limit: 6, message: 'Too many requests. Try again in an hour.' }));
  app.use(['/api/posts', '/api/comments', '/api/reports', '/api/uploads'], (req, res, next) => (req.method === 'POST' ? writeLimit(req, res, next) : next()));
  app.use('/api/account/delete', limiter({ windowMs: 15 * 60_000, limit: 5, skipSuccessfulRequests: true, message: 'Too many attempts. Try again in a few minutes.' }));
  app.use('/api/account/export', limiter({ windowMs: 60 * 60_000, limit: 6, message: 'You asked for several exports. Try again in an hour.' }));
  const writeLimit = limiter({ windowMs: 60_000, limit: 40, message: 'You are posting very quickly. Slow down for a moment.' });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.get('/api', (req, res) => {
    res.json({
      message: 'Voidspace API v0.1.0',
      version: '0.1.0'
    });
  });

  // Mount routes
  app.use('/api/auth', accountSecurityRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/spaces', spaceRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/mod', moderationRoutes);
  app.use('/api/mod', modQueueRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/appeals', appealRoutes);
  app.use('/api', governanceRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/admin', adminGovernanceRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/transparency', transparencyRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/stream', streamRoutes);
  app.use('/api/uploads', uploadRoutes);

  // Uploaded images, when stored on this machine. They are re-encoded WebP, so they are safe to embed from the web app.
  if (!s3Configured()) {
    app.use('/uploads', express.static(uploadDir(), {
      index: false, dotfiles: 'deny', maxAge: '30d', immutable: true,
      setHeaders: (res) => { res.set('Cross-Origin-Resource-Policy', 'cross-origin'); res.set('Content-Security-Policy', "default-src 'none'"); res.set('X-Content-Type-Options', 'nosniff'); },
    }));
  }

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not Found', message: 'No such endpoint.' }); });
  app.use(errorMiddleware);
  app.use((_req, res) => { res.status(404).json({ error: 'Not Found' }); });
  return app;
}
