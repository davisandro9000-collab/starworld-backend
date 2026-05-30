// src/controllers/celebrity.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { ApiError } from '../lib/apiError.js';
import { refreshCelebrityNews } from '../jobs/news.job.js';

export const getCelebrityBySlug = async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const celebrity = await prisma.celebrity.findUnique({
    where: { slug, isPublished: true },
  });
  if (!celebrity) {
    throw ApiError.notFound('Celebrity not found');
  }
  res.json({ success: true, celebrity });
};

export const getAllCelebrities = async (req: Request, res: Response) => {
  const celebrities = await prisma.celebrity.findMany({
    where: { isPublished: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, celebrities });
};

export const getCelebrityNews = async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  
  const celebrity = await prisma.celebrity.findUnique({
    where: { slug, isPublished: true },
    select: { id: true, name: true, slug: true }
  });
  if (!celebrity) {
    throw ApiError.notFound('Celebrity not found');
  }

  const cacheKey = `celebrity:news:${slug}`;
  let news = await redis.get(cacheKey);
  
  if (!news) {
    // Trigger refresh and return empty if none
    const refreshedNews = await refreshCelebrityNews(slug);
    if (!refreshedNews) {
      return res.json({ success: true, celebrity: celebrity.name, articles: [] });
    }
    news = JSON.stringify(refreshedNews);
  }
  
  res.json(typeof news === 'string' ? JSON.parse(news) : news);
};

export const getCelebrityEvents = async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  
  const celebrity = await prisma.celebrity.findUnique({
    where: { slug, isPublished: true },
    select: { id: true, name: true }
  });
  if (!celebrity) {
    throw ApiError.notFound('Celebrity not found');
  }

  const events = await prisma.ticketListingCache.findMany({
    where: { 
      celebrityId: celebrity.id,
      eventDate: { gt: new Date() } // Only future events
    },
    orderBy: { eventDate: 'asc' },
    take: 20
  });

  res.json({ 
    success: true, 
    celebrity: celebrity.name,
    events 
  });
};