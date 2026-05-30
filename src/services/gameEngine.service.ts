import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from './coin.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { NotificationService } from './notification.service.js';

const MIN_GAME_SECONDS = 2;
const CONSOLATION_COINS = 5;

export class GameEngineService {
  private coinService: CoinService;
  private idempotencyService: IdempotencyService;
  private notificationService: NotificationService;

  constructor(
    private prisma: PrismaClient,
    idempotencyService: IdempotencyService
  ) {
    this.idempotencyService = idempotencyService;
    this.coinService = new CoinService(prisma, idempotencyService);
    this.notificationService = new NotificationService(prisma);
  }

  async startSession(userId: string, gameType: string, celebrityId?: string) {
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
      }
    });
    return session;
  }

  async completeGame(
    sessionId: string,
    userId: string,
    score: number,
    gameData: any,
    idempotencyKey: string
  ) {
    return this.idempotencyService.process(idempotencyKey, 86400, async () => {
      const session = await this.prisma.gameSession.findUnique({
        where: { id: sessionId, userId },
        include: { tier: true, user: true }
      });
      if (!session) throw ApiError.notFound('Game session not found');
      if (session.status !== 'active') throw ApiError.badRequest('Game already completed');

      const elapsed = Date.now() - session.startedAt.getTime();
      if (elapsed < MIN_GAME_SECONDS * 1000) {
        await this.flagFraud(userId, sessionId, 'too_fast', elapsed);
        throw ApiError.badRequest(`Game completed too quickly. Minimum ${MIN_GAME_SECONDS} seconds required.`);
      }

      const random = Math.random() * 100;
      const won = random < session.winRateSnapshot;
      const multiplier = Number(session.tier.coinMultiplier);

      let result;
      if (won) {
        result = await this.handleWin(session, score, gameData, multiplier, idempotencyKey);
      } else {
        result = await this.handleLoss(session, multiplier, idempotencyKey);
      }

      this.emitLiveFeed(session.userId, session.user.username, result.prize?.label || `${result.coinsEarned} coins`, session.celebrityId);
      this.updateLeaderboard();

      return result;
    });
  }

  private async handleWin(session: any, score: number, gameData: any, multiplier: number, idempotencyKey: string) {
    const baseCoins = this.getBaseCoinsForGame(session.gameType, score);
    const coinsEarned = Math.round(baseCoins * multiplier);

    let prize = null;
    let prizeCode = null;
    const prizeRoll = Math.random() * 100;
    if (prizeRoll < 20) {
      const prizeResult = await this.awardPrize(session.userId, session.tierId, session.gameType);
      prize = prizeResult.prize;
      prizeCode = prizeResult.code;
    }

    const updatedSession = await this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<{ coin_balance: number }[]>`
        SELECT coin_balance FROM users WHERE id = ${session.userId}::uuid FOR UPDATE
      `;
      const currentBalance = users[0]?.coin_balance ?? 0;
      const newBalance = currentBalance + coinsEarned;

      await tx.user.update({
        where: { id: session.userId },
        data: { coinBalance: newBalance }
      });

      await tx.coinTransaction.create({
        data: {
          userId: session.userId,
          amount: coinsEarned,
          balanceAfter: newBalance,
          type: 'game_win',
          referenceId: session.id,
          note: `Won ${coinsEarned} coins from ${session.gameType}`,
          idempotencyKey
        }
      });

      const updated = await tx.gameSession.update({
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
      return updated;
    });

    // ✅ Fixed: createNotification expects (userId, data)
    await this.notificationService.createNotification(session.userId, {
      type: 'game_win',
      title: prize ? `You won a ${prize.label}!` : 'You won!',
      body: prize ? `You earned ${coinsEarned} coins and a ${prize.label}.` : `You earned ${coinsEarned} coins.`,
      accentColor: '#FFD700',
      ctaLabel: 'Claim Prize',
      ctaUrl: '/dashboard/prizes'
    });

    return {
      won: true,
      coinsEarned,
      prize,
      prizeCode,
      session: updatedSession,
      message: `🎉 You won ${coinsEarned} coins!`
    };
  }

  private async handleLoss(session: any, multiplier: number, idempotencyKey: string) {
    const consolationCoins = Math.round(CONSOLATION_COINS * multiplier);

    const updatedSession = await this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<{ coin_balance: number }[]>`
        SELECT coin_balance FROM users WHERE id = ${session.userId}::uuid FOR UPDATE
      `;
      const currentBalance = users[0]?.coin_balance ?? 0;
      const newBalance = currentBalance + consolationCoins;

      await tx.user.update({
        where: { id: session.userId },
        data: { coinBalance: newBalance }
      });

      await tx.coinTransaction.create({
        data: {
          userId: session.userId,
          amount: consolationCoins,
          balanceAfter: newBalance,
          type: 'game_win',
          referenceId: session.id,
          note: `Consolation: ${consolationCoins} coins from ${session.gameType}`,
          idempotencyKey
        }
      });

      const updated = await tx.gameSession.update({
        where: { id: session.id },
        data: { status: 'lost', completedAt: new Date() }
      });
      return updated;
    });

    // ✅ Fixed: createNotification expects (userId, data)
    await this.notificationService.createNotification(session.userId, {
      type: 'game_loss',
      title: 'Better luck next time!',
      body: `You earned ${consolationCoins} consolation coins. Keep playing!`,
      accentColor: '#CD7F32'
    });

    return {
      won: false,
      consolationCoins,
      session: updatedSession,
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

  private async emitLiveFeed(userId: string, username: string, prizeName: string, celebrityId: string | null) {
    const io = (global as any).io;
    if (io) {
      let starName = 'StarWorld';
      if (celebrityId) {
        const celeb = await this.prisma.celebrity.findUnique({ where: { id: celebrityId } });
        starName = celeb?.name || 'a celebrity';
      }
      io.of('/user').emit('live_feed', {
        winnerName: username,
        prizeName,
        starName
      });
    }
  }

  private async updateLeaderboard() {
    const io = (global as any).io;
    if (io) {
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