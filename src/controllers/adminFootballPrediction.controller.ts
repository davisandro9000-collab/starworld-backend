// src/controllers/adminFootballPrediction.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from '../services/coin.service.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { NotificationService } from '../services/notification.service.js';

const idempotency = new IdempotencyService();
const coinService = new CoinService(prisma, idempotency);
const notificationService = new NotificationService(prisma);

export const createPredictionGame = async (req: Request, res: Response) => {
  const { name, description, predictionType, matchId, points, coinReward, cashReward, startsAt, endsAt } = req.body;
  const game = await prisma.footballPredictionGame.create({
    data: {
      name,
      description,
      predictionType,
      matchId,
      points,
      coinReward,
      cashReward,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    },
  });
  res.status(201).json({ success: true, game });
};

export const updatePredictionGame = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const data = req.body;
  const game = await prisma.footballPredictionGame.update({
    where: { id },
    data,
  });
  res.json({ success: true, game });
};

export const deletePredictionGame = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await prisma.footballPredictionGame.delete({ where: { id } });
  res.json({ success: true });
};

export const resolveGame = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { correctTeamId, correctPlayerId, correctStage, correctValue } = req.body;
  const game = await prisma.footballPredictionGame.findUnique({ where: { id } });
  if (!game) throw ApiError.notFound('Game not found');

  let entries;
  if (game.predictionType === 'WINNER') {
    entries = await prisma.footballPredictionEntry.findMany({
      where: { gameId: id, predictedTeamId: correctTeamId },
    });
  } else if (game.predictionType === 'FIRST_SCORER' || game.predictionType === 'ASSIST') {
    entries = await prisma.footballPredictionEntry.findMany({
      where: { gameId: id, predictedPlayerId: correctPlayerId },
    });
  } else {
    entries = await prisma.footballPredictionEntry.findMany({
      where: { gameId: id, predictedValue: correctValue },
    });
  }

  for (const entry of entries) {
    await prisma.footballPredictionEntry.update({
      where: { id: entry.id },
      data: {
        isCorrect: true,
        pointsEarned: game.points,
        coinEarned: game.coinReward,
        cashEarned: game.cashReward,
      },
    });
    if (game.coinReward > 0) {
      const coinKey = `resolve-game-${id}-${entry.userId}`;
      await coinService.grantCoins(entry.userId, game.coinReward, 'prediction_win', id, `Won prediction: ${game.name}`, coinKey);
    }
    await notificationService.createNotification(entry.userId, {
      type: 'prediction_correct',
      title: 'Prediction Correct!',
      body: `Your prediction for "${game.name}" was correct! You earned ${game.points} points and ${game.coinReward} coins.`,
      accentColor: '#FFD700',
    });
  }

  await prisma.footballPredictionGame.update({
    where: { id },
    data: { resolvedAt: new Date(), isActive: false },
  });
  res.json({ success: true });
};