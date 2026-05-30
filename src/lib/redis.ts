import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!upstashUrl || !upstashToken) {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
}
export const redis = new UpstashRedis({ url: upstashUrl, token: upstashToken });

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is required for BullMQ. Add it to .env');
}

// @ts-ignore - ioredis constructor type mismatch in ESM, but works at runtime
export const bullmqRedis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  tls: { rejectUnauthorized: false },
});

bullmqRedis.on('connect', () => console.log('✅ BullMQ Redis connected'));
bullmqRedis.on('error', (err) => console.error('❌ BullMQ Redis error:', err));