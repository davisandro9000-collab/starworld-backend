// src/lib/redis.ts
import * as RedisModule from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required');
}

// Get the default constructor (works with both ES modules and CommonJS)
const Redis = (RedisModule as any).default || RedisModule;

// Parse Redis URL for BullMQ connection options
const url = new URL(redisUrl);
export const redisConnection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  password: url.password || undefined,
  tls: redisUrl.includes('upstash') ? {} : undefined,
  connectTimeout: 30000,
  maxRetriesPerRequest: null,
};

// Create Redis client instance for direct operations
export const redis = new Redis(redisUrl, {
  tls: redisUrl.includes('upstash') ? {} : undefined,
  maxRetriesPerRequest: null,
  connectTimeout: 30000,
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error('Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 1000, 5000);
  },
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err));