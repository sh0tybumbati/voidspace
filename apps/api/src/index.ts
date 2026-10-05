import 'dotenv/config';
import { createApp } from './app';
import { startAlignmentUpdateJob } from './jobs/alignmentUpdate';
import { startHotScoreUpdateJob } from './jobs/hotScoreUpdate';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 Voidspace API server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Background jobs only run in the real server, never in tests.
  startAlignmentUpdateJob();
  startHotScoreUpdateJob();
});

export default app;
