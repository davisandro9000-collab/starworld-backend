// src/jobs/queue.ts
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { syncTicketmasterEvents } from './tickets.job.js';
import { startStaggeredNewsRefresh } from './news.job.js';
import { syncFootballNews } from './footballNewsSync.job.js';   // <-- ADD this import

const logger = {
  info: (...args: any[]) => console.log('[Queue]', ...args),
  warn: (...args: any[]) => console.warn('[Queue]', ...args),
  error: (...args: any[]) => console.error('[Queue]', ...args),
};

// Queues – use connection options
export const ticketsQueue = new Queue('tickets-sync', { connection: redisConnection });
export const newsQueue = new Queue('news-refresh', { connection: redisConnection });
export const footballNewsQueue = new Queue('football-news-sync', { connection: redisConnection }); // <-- ADD

// Workers – use connection options
new Worker('tickets-sync', async (job) => {
  logger.info(`Running Ticketmaster sync job`);
  await syncTicketmasterEvents();
}, { connection: redisConnection });

new Worker('news-refresh', async (job) => {
  logger.info(`Running staggered news refresh`);
  await startStaggeredNewsRefresh();
}, { connection: redisConnection });

new Worker('football-news-sync', async (job) => {                // <-- ADD this worker
  logger.info(`Running football news sync job`);
  await syncFootballNews();
}, { connection: redisConnection });

// Schedule jobs
export async function scheduleJobs() {
  try {
    if (process.env.TICKETMASTER_API_KEY) {
      await ticketsQueue.add('sync-tickets', {}, {
        repeat: { pattern: '0 */2 * * *' },
        removeOnComplete: true,
        removeOnFail: false
      });
      logger.info('✅ Scheduled Ticketmaster sync job (every 2 hours)');
    } else {
      logger.warn('⚠️ TICKETMASTER_API_KEY not set, skipping sync');
    }
    
    if (process.env.NEWSAPI_KEY) {
      await newsQueue.add('refresh-news', {}, {
        delay: 5000,
        removeOnComplete: true
      });
      logger.info('✅ Scheduled news refresh job (staggered)');
    } else {
      logger.warn('⚠️ NEWSAPI_KEY not set, skipping news refresh');
    }

    // Schedule football news sync daily at 2:00 AM UTC (no API key required)
    await footballNewsQueue.add('sync-football-news', {}, {
      repeat: { pattern: '0 2 * * *' },
      removeOnComplete: true,
      removeOnFail: false,
    });
    logger.info('✅ Scheduled football news sync job (daily at 02:00 UTC)');
    
  } catch (error) {
    logger.error('Failed to schedule jobs:', error);
  }
}