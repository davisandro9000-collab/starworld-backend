import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { GameService } from '../services/game.service.js';
import { z } from 'zod';

const idempotencyService = new IdempotencyService();
const gameService = new GameService(prisma, idempotencyService);

const startGameSchema = z.object({
  gameType: z.enum(['trivia', 'memory', 'number_guess', 'word_scramble', 'hangman', 'spin']),
  celebrityId: z.string().uuid().optional()
});

const completeGameSchema = z.object({
  score: z.number().min(0),
  gameData: z.any().optional()
});

export const startGame = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { gameType, celebrityId } = startGameSchema.parse(req.body);

  const session = await gameService.startGame(userId, gameType, celebrityId);

  res.status(201).json({
    success: true,
    session: {
      id: session.id,
      gameType: session.gameType,
      winRateSnapshot: session.winRateSnapshot,
      startedAt: session.startedAt
    }
  });
};

export const completeGame = async (req: Request, res: Response) => {
  // Ensure sessionId is a string, not string[]
  const sessionId = Array.isArray(req.params.sessionId) 
    ? req.params.sessionId[0] 
    : req.params.sessionId;
  
  const userId = req.user!.id;
  const idempotencyKey = req.idempotencyKey;
  const { score, gameData } = completeGameSchema.parse(req.body);

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }

  const result = await gameService.completeGame(
    sessionId,
    userId,
    score,
    gameData || {},
    idempotencyKey
  );

  res.json({
    success: true,
    ...result
  });
};

export const getGameHistory = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const result = await gameService.getUserGameHistory(userId, page, limit);

  res.json({
    success: true,
    ...result
  });
};

export const getLeaderboard = async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;

  const leaderboard = await gameService.getLeaderboard(limit);

  res.json({
    success: true,
    leaderboard
  });
};