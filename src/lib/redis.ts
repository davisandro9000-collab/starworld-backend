// src/lib/redis.ts
import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

// Upstash Redis for app (REST API)
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!upstashUrl || !upstashToken) {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
}
export const redis = new UpstashRedis({
  url: upstashUrl,
  token: upstashToken,
});

// ioredis for BullMQ (standard Redis protocol)
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is required for BullMQ. Add it to .env');
}

// BullMQ requires maxRetriesPerRequest: null
export const bullmqRedis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  tls: {
    rejectUnauthorized: false, // required for Upstash TLS
  },
});

bullmqRedis.on('connect', () => {
  console.log('✅ BullMQ Redis connected');
});

bullmqRedis.on('error', (err) => {
  console.error('❌ BullMQ Redis error:', err);
});