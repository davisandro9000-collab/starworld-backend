// src/jobs/queue.ts
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { startStaggeredNewsRefresh } from './news.job.js';
import { syncFootballNews } from './footballNewsSync.job.js';

const logger = {
  info: (...args: any[]) => console.log('[Queue]', ...args),
  warn: (...args: any[]) => console.warn('[Queue]', ...args),
  error: (...args: any[]) => console.error('[Queue]', ...args),
};

// Queues – only keep the ones you actually use
export const newsQueue = new Queue('news-refresh', { connection: redisConnection });
export const footballNewsQueue = new Queue('football-news-sync', { connection: redisConnection });

// Workers
new Worker('news-refresh', async (job) => {
  logger.info(`Running staggered news refresh`);
  await startStaggeredNewsRefresh();
}, { connection: redisConnection });

new Worker('football-news-sync', async (job) => {
  logger.info(`Running football news sync job`);
  await syncFootballNews();
}, { connection: redisConnection });

// Schedule jobs – only schedule the ones you need
export async function scheduleJobs() {
  try {
    // Staggered celebrity news refresh (requires NEWSAPI_KEY)
    if (process.env.NEWSAPI_KEY) {
      await newsQueue.add('refresh-news', {}, {
        delay: 5000,
        removeOnComplete: true
      });
      logger.info('✅ Scheduled news refresh job (staggered)');
    } else {
      logger.warn('⚠️ NEWSAPI_KEY not set, skipping news refresh');
    }

    // Football news sync – runs daily at 2 AM UTC (no API key required)
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