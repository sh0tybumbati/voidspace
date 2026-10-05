import 'dotenv/config';
import { createApp } from './app';
import { checkConfig } from './lib/config';
import { startAlignmentUpdateJob } from './jobs/alignmentUpdate';
import { startHotScoreUpdateJob } from './jobs/hotScoreUpdate';
import { startGovernanceCloseJob } from './jobs/governanceClose';

const { problems, warnings } = checkConfig();
for (const w of warnings) console.warn(`⚠️  ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`❌ ${p}`);
  console.error('Fix the settings above and start again.');
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 Voidspace API server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Background jobs only run in the real server, never in tests.
  startAlignmentUpdateJob();
  startHotScoreUpdateJob();
  startGovernanceCloseJob();
});

export default app;
