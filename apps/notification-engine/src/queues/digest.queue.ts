import { Queue } from 'bullmq';
import { connection } from './index.js';

export const digestQueue = new Queue('daily-digest', { connection: connection as any });

// Schedule the digest to run every day at 04:00 UTC (07:00 AM EAT)
export async function scheduleDigestJob() {
    await digestQueue.add('DAILY_DIGEST_RUN', {}, {
        repeat: {
            pattern: '0 4 * * *', // UTC timezone
        },
        jobId: 'chv-daily-digest-cron'
    });
}
