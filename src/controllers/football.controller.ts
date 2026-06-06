import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { refreshFootballStarNews } from '../jobs/news.job.js';

export const getFootballStars = async (req: Request, res: Response) => {
  const stars = await prisma.footballStar.findMany({
    where: { isPublished: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, stars });
};

export const getFootballStarBySlug = async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const star = await prisma.footballStar.findUnique({
    where: { slug, isPublished: true },
  });
  if (!star) throw ApiError.notFound('Football star not found');
  res.json({ success: true, star });
};

export const getFootballStarNews = async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  try {
    const result = await refreshFootballStarNews(slug);
    res.json(result || { star: slug, articles: [] });
  } catch (err) {
    console.error('Football star news error:', err);
    res.json({ star: slug, articles: [] });
  }
};

export const getMatches = async (req: Request, res: Response) => {
  const { tournament, status } = req.query;
  const where: any = { isPublished: true };
  if (tournament) where.tournament = tournament;
  if (status) where.status = status;
  const matches = await prisma.footballMatch.findMany({
    where,
    orderBy: { matchDate: 'asc' },
    include: { winner: true },
  });
  res.json({ success: true, matches });
};

export const getMatchById = async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const match = await prisma.footballMatch.findUnique({
    where: { id },
    include: { winner: true },
  });
  if (!match) throw ApiError.notFound('Match not found');
  res.json({ success: true, match });
};

export const getUserPredictions = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const predictions = await prisma.footballPrediction.findMany({
    where: { userId },
    include: { match: true, predictedWinner: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, predictions });
};

export const submitPrediction = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { matchId, predictedWinnerId, predictedScore } = req.body;
  const existing = await prisma.footballPrediction.findUnique({
    where: { userId_matchId: { userId, matchId } },
  });
  if (existing) throw ApiError.badRequest('You already predicted this match');
  const match = await prisma.footballMatch.findUnique({ where: { id: matchId } });
  if (!match || match.status !== 'upcoming') throw ApiError.badRequest('Match not available for prediction');
  const prediction = await prisma.footballPrediction.create({
    data: { userId, matchId, predictedWinnerId, predictedScore },
  });
  res.status(201).json({ success: true, prediction });
};

export const getLeaderboard = async (req: Request, res: Response) => {
  const leaderboard = await prisma.footballPrediction.groupBy({
    by: ['userId'],
    _sum: { pointsEarned: true },
    orderBy: { _sum: { pointsEarned: 'desc' } },
    take: 20,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: leaderboard.map(l => l.userId) } },
    select: { id: true, username: true, avatarUrl: true },
  });
  const result = leaderboard.map(l => ({
    userId: l.userId,
    username: users.find(u => u.id === l.userId)?.username,
    avatarUrl: users.find(u => u.id === l.userId)?.avatarUrl,
    totalPoints: l._sum.pointsEarned || 0,
  }));
  res.json({ success: true, leaderboard: result });
};