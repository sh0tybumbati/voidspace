import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import spaceRoutes from './routes/spaces';
import postRoutes from './routes/posts';
import commentRoutes from './routes/comments';
import moderationRoutes from './routes/moderation';
import searchRoutes from './routes/search';
import adminRoutes from './routes/admin';

// Import background jobs
import { startAlignmentUpdateJob } from './jobs/alignmentUpdate';
import { startHotScoreUpdateJob } from './jobs/hotScoreUpdate';

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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Voidspace API server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start background jobs
  startAlignmentUpdateJob();
  startHotScoreUpdateJob();
});

export default app;
