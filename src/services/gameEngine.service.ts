import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from './coin.service.js';
import { IdempotencyService } from './idempotency.service.js';

const MIN_GAME_SECONDS = 2;
const CONSOLATION_COINS = 5;

export class GameEngineService {
  private coinService: CoinService;

  constructor(
    private prisma: PrismaClient,
    idempotencyService: IdempotencyService
  ) {
    this.coinService = new CoinService(prisma, idempotencyService);
  }

  async startSession(userId: string, gameType: string, celebrityId?: string, idempotencyKey?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tier: true }
    });
    if (!user) throw ApiError.notFound('User not found');
    if (user.isBanned) throw ApiError.forbidden('Account is banned');
    const winRate = gameType === 'spin' ? user.tier.spinWinRate : user.tier.gameWinRate;
    const session = await this.prisma.gameSession.create({
      data: {
        userId,
        celebrityId,
        gameType,
        tierId: user.tierId!,
        winRateSnapshot: winRate,
        status: 'active',
        gameData: { startedAt: new Date().toISOString() }
      }
    });
    return session;
  }

  async completeGame(sessionId: string, userId: string, score: number, gameData: any, idempotencyKey: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId, userId },
      include: { tier: true }
    });
    if (!session) throw ApiError.notFound('Game session not found');
    if (session.status !== 'active') throw ApiError.badRequest('Game already completed');
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    if (elapsed < MIN_GAME_SECONDS * 1000) {
      await this.flagFraud(userId, sessionId, 'too_fast', elapsed);
      throw ApiError.badRequest(`Game completed too quickly. Minimum ${MIN_GAME_SECONDS} seconds required.`);
    }
    const random = Math.random() * 100;
    const won = random < session.winRateSnapshot;
    const tier = await this.prisma.tier.findUnique({ where: { id: session.tierId } });
    if (!tier) throw ApiError.internal('Tier configuration missing');
    const multiplier = Number(tier.coinMultiplier);
    if (won) {
      return await this.handleWin(session, userId, score, gameData, multiplier, idempotencyKey);
    } else {
      return await this.handleLoss(session, userId, multiplier, idempotencyKey);
    }
  }

  private async handleWin(session: any, userId: string, score: number, gameData: any, multiplier: number, idempotencyKey: string) {
    const baseCoins = this.getBaseCoinsForGame(session.gameType, score);
    const coinsEarned = Math.round(baseCoins * multiplier);
    let prize = null;
    let prizeCode = null;
    const prizeRoll = Math.random() * 100;
    if (prizeRoll < 20) {
      const prizeResult = await this.awardPrize(userId, session.tierId, session.gameType);
      prize = prizeResult.prize;
      prizeCode = prizeResult.code;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSession = await tx.gameSession.update({
        where: { id: session.id },
        data: {
          status: 'won',
          score,
          coinsEarned,
          prizeWon: prize?.label,
          prizeCode,
          gameData,
          completedAt: new Date()
        }
      });
      const user = await tx.user.findUnique({ where: { id: userId }, select: { coinBalance: true } });
      const newBalance = user!.coinBalance + coinsEarned;
      await tx.user.update({ where: { id: userId }, data: { coinBalance: newBalance } });
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: coinsEarned,
          balanceAfter: newBalance,
          type: 'game_win',
          referenceId: session.id,
          note: `Won ${coinsEarned} coins from ${session.gameType}`,
          idempotencyKey
        }
      });
      return updatedSession;
    });

    // Socket.IO emissions: live feed and leaderboard
    const io = (global as any).io;
    if (io) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
      io.of('/user').emit('live_feed', {
        winnerName: user?.username || 'Someone',
        prizeName: prize?.label || `${coinsEarned} coins`,
        starName: session.celebrityId ? 'a celebrity' : 'StarWorld',
      });
      // Emit updated leaderboard
      const topWinners = await this.prisma.gameSession.groupBy({
        by: ['userId'],
        where: { status: 'won' },
        _sum: { coinsEarned: true },
        orderBy: { _sum: { coinsEarned: 'desc' } },
        take: 5,
      });
      const leaderboard = await Promise.all(topWinners.map(async (w) => {
        const u = await this.prisma.user.findUnique({ where: { id: w.userId }, select: { username: true } });
        return { username: u?.username, totalCoins: w._sum.coinsEarned };
      }));
      io.of('/user').emit('leaderboard_update', leaderboard);
    }

    return {
      won: true,
      coinsEarned,
      prize,
      prizeCode,
      session: result,
      message: `🎉 You won ${coinsEarned} coins!`
    };
  }

  private async handleLoss(session: any, userId: string, multiplier: number, idempotencyKey: string) {
    const consolationCoins = Math.round(CONSOLATION_COINS * multiplier);
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSession = await tx.gameSession.update({
        where: { id: session.id },
        data: { status: 'lost', completedAt: new Date() }
      });
      const user = await tx.user.findUnique({ where: { id: userId }, select: { coinBalance: true } });
      const newBalance = user!.coinBalance + consolationCoins;
      await tx.user.update({ where: { id: userId }, data: { coinBalance: newBalance } });
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: consolationCoins,
          balanceAfter: newBalance,
          type: 'game_win',
          referenceId: session.id,
          note: `Consolation: ${consolationCoins} coins from ${session.gameType}`,
          idempotencyKey
        }
      });
      return updatedSession;
    });
    return {
      won: false,
      consolationCoins,
      session: result,
      message: `😢 Better luck next time! You got ${consolationCoins} consolation coins.`
    };
  }

  private getBaseCoinsForGame(gameType: string, score: number): number {
    const gameRewards: Record<string, number> = {
      trivia: 20,
      memory: 15,
      number_guess: 100,
      word_scramble: 40,
      hangman: 60,
      spin: 10 + Math.floor(Math.random() * 90)
    };
    let base = gameRewards[gameType] || 25;
    if (gameType === 'trivia' && score === 100) base += 30;
    if (gameType === 'memory' && score > 8) base += Math.floor(score / 2);
    return base;
  }

  private async awardPrize(userId: string, tierId: string, gameType: string) {
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    const prizes = await this.prisma.prize.findMany({
      where: {
        isActive: true,
        OR: [{ tierSlug: null }, { tierSlug: tier?.slug }]
      }
    });
    if (prizes.length === 0) return { prize: null, code: null };
    const randomIndex = Math.floor(Math.random() * prizes.length);
    const prize = prizes[randomIndex];
    const prizeCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    await this.prisma.prizeRedemption.create({
      data: { userId, prizeId: prize.id, code: prizeCode, status: 'pending' }
    });
    return { prize, code: prizeCode };
  }

  private async flagFraud(userId: string, sessionId: string, reason: string, details: any) {
    console.log(`🚨 FRAUD ALERT: User ${userId} on session ${sessionId} - ${reason}`, details);
  }

  async getLeaderboard(limit: number = 20) {
    const winners = await this.prisma.gameSession.groupBy({
      by: ['userId'],
      where: { status: 'won' },
      _sum: { coinsEarned: true },
      orderBy: { _sum: { coinsEarned: 'desc' } },
      take: limit
    });
    const leaderboard = await Promise.all(winners.map(async (winner) => {
      const user = await this.prisma.user.findUnique({
        where: { id: winner.userId },
        select: { username: true, avatarUrl: true, tier: true }
      });
      return {
        userId: winner.userId,
        username: user?.username,
        avatarUrl: user?.avatarUrl,
        tier: user?.tier,
        totalCoinsWon: winner._sum.coinsEarned || 0
      };
    }));
    return leaderboard;
  }
}