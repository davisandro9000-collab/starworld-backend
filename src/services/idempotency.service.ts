import { redis } from '../lib/redis.js';

export class IdempotencyService {
  async process<T>(
    key: string,
    ttlSeconds: number = 86400,
    handler: () => Promise<T>
  ): Promise<{ executed: boolean; result: T }> {
    const dedupeKey = `idempotent:${key}`;

    try {
      const existing = await redis.get(dedupeKey);
      if (existing && typeof existing === 'string') {
        return { executed: false, result: JSON.parse(existing) as T };
      }
    } catch (error) {
      console.warn('Idempotency check failed, continuing:', error);
    }

    const result = await handler();
    try {
      await redis.set(dedupeKey, JSON.stringify(result), { ex: ttlSeconds });
    } catch (error) {
      console.warn('Failed to cache idempotency result:', error);
    }

    return { executed: true, result };
  }
}