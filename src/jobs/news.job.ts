// src/jobs/news.job.ts
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const NEWS_API_KEY = process.env.NEWSAPI_KEY;
const BASE_URL = 'https://newsapi.org/v2';

const logger = {
  info: (...args: any[]) => console.log('[NewsJob]', ...args),
  warn: (...args: any[]) => console.warn('[NewsJob]', ...args),
  error: (...args: any[]) => console.error('[NewsJob]', ...args),
};

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  source: string;
}

export async function refreshCelebrityNews(celebritySlug: string) {
  if (!NEWS_API_KEY) {
    logger.warn('NEWSAPI_KEY not set, skipping news refresh');
    return null;
  }

  const celebrity = await prisma.celebrity.findUnique({
    where: { slug: celebritySlug, isPublished: true },
    select: { id: true, name: true, slug: true }
  });
  if (!celebrity) return null;

  const cacheKey = `celebrity:news:${celebritySlug}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const url = `${BASE_URL}/everything?q=${encodeURIComponent(celebrity.name)}&pageSize=5&language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json() as any;

    if (!response.ok || data?.status !== 'ok') {
      logger.error(`News API error for ${celebrity.name}:`, data);
      return null;
    }

    // Fix: ensure articles is an array (default to empty array)
    const articlesArray = Array.isArray(data?.articles) ? data.articles : [];
    
    const articles: NewsArticle[] = articlesArray.map((article: any) => ({
      title: article?.title || '',
      description: article?.description || '',
      url: article?.url || '',
      imageUrl: article?.urlToImage || null,
      publishedAt: article?.publishedAt || new Date().toISOString(),
      source: article?.source?.name || 'Unknown'
    }));

    const result = { celebrity: celebrity.name, articles };
    
    await redis.setex(cacheKey, 4 * 60 * 60, JSON.stringify(result));
    
    logger.info(`Refreshed news for ${celebrity.name}: ${articles.length} articles`);
    return result;
    
  } catch (error) {
    logger.error(`Failed to fetch news for ${celebrity.name}:`, error);
    return null;
  }
}

export async function startStaggeredNewsRefresh() {
  logger.info('Starting staggered celebrity news refresh job');
  
  const celebrities = await prisma.celebrity.findMany({
    where: { isPublished: true },
    select: { slug: true }
  });
  
  for (const celebrity of celebrities) {
    await refreshCelebrityNews(celebrity.slug);
    await new Promise(resolve => setTimeout(resolve, 8 * 60 * 1000));
  }
}