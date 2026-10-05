import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import spaceRoutes from './routes/spaces';
import postRoutes from './routes/posts';
import commentRoutes from './routes/comments';
import moderationRoutes from './routes/moderation';
import searchRoutes from './routes/search';
import adminRoutes from './routes/admin';
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


export function createApp(): express.Express {
  const app = express();
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, originAllowed(origin)),
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

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
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/spaces', spaceRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/mod', moderationRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not Found', message: 'No such endpoint.' }); });
  app.use(errorMiddleware);
  app.use((_req, res) => { res.status(404).json({ error: 'Not Found' }); });
  return app;
}
