import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

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