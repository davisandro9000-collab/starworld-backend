import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const NEWS_API_KEY = process.env.NEWSAPI_KEY;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';
const GNEWS_URL = 'https://gnews.io/api/v4/search';

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

// For celebrities
export async function refreshCelebrityNews(celebritySlug: string) {
  try {
    const celebrity = await prisma.celebrity.findUnique({
      where: { slug: celebritySlug, isPublished: true },
      select: { name: true },
    });
    if (!celebrity) return null;
    const cacheKey = `celebrity:news:${celebritySlug}`;
    let cached = null;
    try { cached = await redis.get(cacheKey); } catch {}
    if (cached) return JSON.parse(cached);
    let articles = await fetchFromNewsAPI(celebrity.name);
    let source = 'NewsAPI';
    if (!articles.length && GNEWS_API_KEY) {
      articles = await fetchFromGNews(celebrity.name);
      source = 'GNews';
    }
    const result = { celebrity: celebrity.name, articles };
    try { await redis.setex(cacheKey, 6 * 60 * 60, JSON.stringify(result)); } catch {}
    logger.info(`Refreshed news for ${celebrity.name}: ${articles.length} articles from ${source}`);
    return result;
  } catch (err) {
    logger.error(`refreshCelebrityNews failed for ${celebritySlug}:`, err);
    return { celebrity: celebritySlug, articles: [] };
  }
}

// Football news is handled by footballNewsSync.job.ts – no longer needed here.

export async function startStaggeredNewsRefresh() {
  logger.info('Starting staggered celebrity news refresh job');
  const celebrities = await prisma.celebrity.findMany({
    where: { isPublished: true },
    select: { slug: true },
  });
  for (const celeb of celebrities) {
    await refreshCelebrityNews(celeb.slug);
    await new Promise(resolve => setTimeout(resolve, 8 * 60 * 1000));
  }
}