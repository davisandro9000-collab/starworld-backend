import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

export const getActiveGames = async (req: Request, res: Response) => {
  const games = await prisma.footballPredictionGame.findMany({
    where: { isActive: true, endsAt: { gt: new Date() } },
    include: {
      match: { include: { homeTeam: true, awayTeam: true } },
    },
    orderBy: { endsAt: 'asc' },
  });
  res.json({ success: true, games });
};

export const submitPredictionEntry = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { gameId, predictedTeamId, predictedPlayerId, predictedStage, predictedValue } = req.body;
  const idempotencyKey = req.headers['idempotency-key'] as string;
  if (!idempotencyKey) throw ApiError.badRequest('Idempotency-Key required');

  const game = await prisma.footballPredictionGame.findUnique({ where: { id: gameId } });
  if (!game) throw ApiError.notFound('Game not found');
  if (game.endsAt < new Date()) throw ApiError.badRequest('Game closed');
  const existing = await prisma.footballPredictionEntry.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });
  if (existing) throw ApiError.badRequest('Already submitted');

  const entry = await prisma.footballPredictionEntry.create({
    data: {
      gameId,
      userId,
      predictedTeamId,
      predictedPlayerId,
      predictedStage,
      predictedValue,
    },
  });
  res.status(201).json({ success: true, entry });
};

export const getUserPredictionEntries = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const entries = await prisma.footballPredictionEntry.findMany({
    where: { userId },
    include: { game: { include: { match: { include: { homeTeam: true, awayTeam: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, entries });
};

export const getPredictionLeaderboard = async (req: Request, res: Response) => {
  const leaderboard = await prisma.footballPredictionEntry.groupBy({
    by: ['userId'],
    _sum: { pointsEarned: true, coinEarned: true },
    orderBy: { _sum: { pointsEarned: 'desc' } },
    take: 50,
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
    totalCoins: l._sum.coinEarned || 0,
  }));
  res.json({ success: true, leaderboard: result });
};