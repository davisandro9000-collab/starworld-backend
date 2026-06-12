// src/controllers/footballNews.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const getNewsForTeam = async (req: Request, res: Response) => {
  const teamSlug = req.params.slug as string; // ← add "as string"
  const team = await prisma.footballTeam.findUnique({ where: { slug: teamSlug } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const news = await prisma.footballNews.findMany({
    where: { teamId: team.id },
    orderBy: { publishedAt: 'desc' },
    take: 20,
  });
  res.json({ success: true, news });
};