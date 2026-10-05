import cron from 'node-cron';
import { closeDueGovernance } from '../services/governance';

/** Every five minutes, close any election or community vote whose time is up. */
export function startGovernanceCloseJob(): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { elections, votes } = await closeDueGovernance();
      if (elections || votes) console.log(`Governance: closed ${elections} election(s) and ${votes} vote(s)`);
    } catch (err) {
      console.error('Governance close job failed:', err);
    }
  });
  console.log('Governance close job scheduled (every 5 minutes)');
}
