import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const NEWS_API_KEY = process.env.NEWSAPI_KEY;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';
const GNEWS_URL = 'https://gnews.io/api/v4/search';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// In‑memory cache (fallback if Redis fails)
const memoryCache = new Map<string, { data: any; expiry: number }>();

const logger = {
  info: (...args: any[]) => console.log('[NewsJob]', ...args),
  warn: (...args: any[]) => console.warn('[NewsJob]', ...args),
  error: (...args: any[]) => console.error('[NewsJob]', ...args),
};

async function fetchFromNewsAPI(celebrityName: string) {
  if (!NEWS_API_KEY) return [];
  try {
    const url = `${BASE_URL}/everything?q=${encodeURIComponent(celebrityName)}&pageSize=5&language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== 'ok' || !data.articles) return [];
    return data.articles.map((a: any) => ({
      title: a.title || '',
      description: a.description || '',
      url: a.url || '',
      imageUrl: a.urlToImage || null,
      publishedAt: a.publishedAt || new Date().toISOString(),
      source: a.source?.name || 'NewsAPI',
    }));
  } catch (err) {
    logger.error('NewsAPI fetch error:', err);
    return [];
  }
}

async function fetchFromGNews(celebrityName: string) {
  if (!GNEWS_API_KEY) return [];
  try {
    const url = `${GNEWS_URL}?q=${encodeURIComponent(celebrityName)}&lang=en&max=5&apikey=${GNEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.articles) return [];
    return data.articles.map((a: any) => ({
      title: a.title || '',
      description: a.description || '',
      url: a.url || '',
      imageUrl: a.image || null,
      publishedAt: a.publishedAt || new Date().toISOString(),
      source: a.source?.name || 'GNews',
    }));
  } catch (err) {
    logger.error('GNews fetch error:', err);
    return [];
  }
}

// Helper to get from cache (Redis or memory)
async function getCached(key: string) {
  try {
    const redisVal = await redis.get(key);
    if (redisVal) return JSON.parse(redisVal);
  } catch (err) {
    logger.warn(`Redis get failed for ${key}, using memory cache`, err);
    const mem = memoryCache.get(key);
    if (mem && mem.expiry > Date.now()) return mem.data;
  }
  return null;
}

// Helper to set cache (Redis and memory)
async function setCached(key: string, data: any, ttlSeconds: number) {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    logger.warn(`Redis set failed for ${key}, storing in memory`, err);
  }
  memoryCache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

export async function refreshCelebrityNews(celebritySlug: string, bypassCache = false) {
  try {
    const celebrity = await prisma.celebrity.findUnique({
      where: { slug: celebritySlug, isPublished: true },
      select: { name: true },
    });
    if (!celebrity) return null;

    const cacheKey = `celebrity:news:${celebritySlug}`;

    if (!bypassCache) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.info(`Cache hit for ${celebrity.name}`);
        return cached;
      }
    }

    let articles = await fetchFromNewsAPI(celebrity.name);
    let source = 'NewsAPI';

    if (!articles.length && GNEWS_API_KEY) {
      articles = await fetchFromGNews(celebrity.name);
      source = 'GNews';
    }

    const result = { celebrity: celebrity.name, articles };
    logger.info(`Fetched ${articles.length} articles for ${celebrity.name} from ${source}`);

    await setCached(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    logger.error(`refreshCelebrityNews failed for ${celebritySlug}:`, err);
    return { celebrity: celebritySlug, articles: [] };
  }
}

export async function startStaggeredNewsRefresh() {
  logger.info('Starting staggered celebrity news refresh job');
  const celebrities = await prisma.celebrity.findMany({
    where: { isPublished: true },
    select: { slug: true },
  });
  for (const celeb of celebrities) {
    await refreshCelebrityNews(celeb.slug, true); // bypass cache to force refresh
    await new Promise(resolve => setTimeout(resolve, 8 * 60 * 1000));
  }
}