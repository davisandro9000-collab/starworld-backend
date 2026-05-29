import { PrismaClient } from '@prisma/client';
import { GameEngineService } from './gameEngine.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { ApiError } from '../lib/apiError.js';

export class GameService {
  private gameEngine: GameEngineService;

  constructor(
    private prisma: PrismaClient,
    idempotencyService: IdempotencyService
  ) {
    this.gameEngine = new GameEngineService(prisma, idempotencyService);
  }

  async startGame(userId: string, gameType: string, celebrityId?: string) {
    const validGames = ['trivia', 'memory', 'number_guess', 'word_scramble', 'hangman', 'spin'];
    if (!validGames.includes(gameType)) {
      throw ApiError.badRequest('Invalid game type');
    }

    if (celebrityId) {
      const celebrity = await this.prisma.celebrity.findUnique({
        where: { id: celebrityId, isPublished: true }
      });
      if (!celebrity) {
        throw ApiError.notFound('Celebrity not found');
      }
    }

    const session = await this.gameEngine.startSession(userId, gameType, celebrityId);
    return session;
  }

  async completeGame(
    sessionId: string,
    userId: string,
    score: number,
    gameData: any,
    idempotencyKey: string
  ) {
    const result = await this.gameEngine.completeGame(
      sessionId,
      userId,
      score,
      gameData,
      idempotencyKey
    );
    return result;
  }

  async getUserGameHistory(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [games, total] = await Promise.all([
      this.prisma.gameSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },  // ← Changed from createdAt to startedAt
        include: {
          celebrity: {
            select: { name: true, slug: true }
          }
        },
        skip,
        take: limit
      }),
      this.prisma.gameSession.count({ where: { userId } })
    ]);

    return {
      games,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getLeaderboard(limit: number = 20) {
    return await this.gameEngine.getLeaderboard(limit);
  }
}