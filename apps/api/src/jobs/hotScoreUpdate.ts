import cron from 'node-cron';
import { updateAllPostHotScores } from '../services/hotScore';

/**
 * Schedule hot score updates to run every 15 minutes
 */
export function startHotScoreUpdateJob() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Hot Score Job] Starting hot score update...');
    try {
      await updateAllPostHotScores();
      console.log('[Hot Score Job] Hot score update completed');
    } catch (error) {
      console.error('[Hot Score Job] Error updating hot scores:', error);
    }
  });

  console.log('✅ Hot score update job scheduled (every 15 minutes)');
}

/**
 * Run hot score update immediately (for manual triggers)
 */
export async function runHotScoreUpdateNow(): Promise<void> {
  console.log('[Hot Score Job] Manual hot score update triggered');
  await updateAllPostHotScores();
}
