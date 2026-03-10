import cron from 'node-cron';
import { calculateAllUserAlignments } from '../services/alignment';

/**
 * Background job to update alignment scores for all users
 * Runs every 5 minutes
 *
 * This is more efficient than updating on every single vote,
 * while still keeping scores reasonably fresh
 */
export const startAlignmentUpdateJob = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('[Alignment Job] Starting alignment update...');
      await calculateAllUserAlignments();
      console.log('[Alignment Job] Alignment update completed');
    } catch (error) {
      console.error('[Alignment Job] Error updating alignments:', error);
    }
  });

  console.log('✅ Alignment update job scheduled (every 5 minutes)');
};

/**
 * Alternative: Update alignment immediately on vote
 * More accurate but higher database load
 * Use this if you prefer real-time alignment updates
 */
import { calculateAlignment } from '../services/alignment';

export const updateUserAlignmentOnVote = async (userId: string): Promise<void> => {
  try {
    await calculateAlignment(userId);
  } catch (error) {
    console.error('Error updating user alignment on vote:', error);
    // Don't throw - vote should succeed even if alignment update fails
  }
};
