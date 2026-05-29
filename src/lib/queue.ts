import { Queue } from 'bullmq';
import { bullmqRedis } from './redis.js';

export const QUEUES = {
  AUCTION_RESOLVE: 'auction-resolve',
  EMAIL: 'email',
  NOTIFICATION: 'notification',
};

// Use type assertion to satisfy TypeScript – at runtime it works.
const connection = bullmqRedis as any;

export const auctionQueue = new Queue(QUEUES.AUCTION_RESOLVE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const emailQueue = new Queue(QUEUES.EMAIL, { connection });
export const notificationQueue = new Queue(QUEUES.NOTIFICATION, { connection });