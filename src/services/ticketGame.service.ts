// src/services/ticketGame.service.ts
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from './coin.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { randomBytes } from 'crypto';

const MIN_TAP_MS = 150;                // minimum reaction time (anti‑cheat)
const TIE_WINDOW_MS = 50;              // if taps within 50ms, tie break by tier
const OFFER_EXPIRY_SECONDS = 600;      // 10 minutes

export class TicketGameService {
  private coinService: CoinService;

  constructor(
    private prisma: PrismaClient,
    idempotencyService: IdempotencyService
  ) {
    this.coinService = new CoinService(prisma, idempotencyService);
  }

  // Create an offer after winning a cash prize (called by game engine)
  async createOffer(userId: string, prizeId: string, wagerCoins: number, idempotencyKey: string) {
    const expiresAt = new Date(Date.now() + OFFER_EXPIRY_SECONDS * 1000);
    const offer = await this.prisma.ticketGameOffer.create({
      data: {
        userId,
        prizeId,
        wagerCoins,
        expiresAt,
        idempotencyKey,
        status: 'pending',
      },
    });
    return offer;
  }

  // User accepts an offer – enters matchmaking
  async enterMatchmaking(offerId: string, userId: string, idempotencyKey: string) {
    const offer = await this.prisma.ticketGameOffer.findUnique({
      where: { id: offerId, status: 'pending', expiresAt: { gt: new Date() } },
    });
    if (!offer) throw ApiError.notFound('Offer expired or not found');
    if (offer.userId === userId) throw ApiError.badRequest('Cannot accept your own offer');

    // Look for waiting opponent (another user with pending offer)
    const waitingOffer = await this.prisma.ticketGameOffer.findFirst({
      where: {
        status: 'pending',
        expiresAt: { gt: new Date() },
        userId: { not: userId },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (waitingOffer) {
      // Match found – create session
      const prize = await this.prisma.prize.findUnique({ where: { id: waitingOffer.prizeId } });
      if (!prize) throw ApiError.internal('Prize not found');

      const session = await this.prisma.$transaction(async (tx) => {
        // Mark both offers as accepted
        await tx.ticketGameOffer.update({
          where: { id: waitingOffer.id },
          data: { status: 'accepted' },
        });
        await tx.ticketGameOffer.update({
          where: { id: offerId },
          data: { status: 'accepted' },
        });

        // Create game session
        const session = await tx.ticketGameSession.create({
          data: {
            player1Id: waitingOffer.userId,
            player2Id: userId,
            offerId: waitingOffer.id,
            prizeId: waitingOffer.prizeId,
            status: 'waiting',
          },
        });
        return session;
      });

      return { matched: true, sessionId: session.id, opponentId: waitingOffer.userId, prize };
    } else {
      // No opponent – just mark this offer as pending (already pending)
      return { matched: false, offerId };
    }
  }

  // Start the game (emit start signal via Socket.IO later)
  async startGame(sessionId: string) {
    const session = await this.prisma.ticketGameSession.update({
      where: { id: sessionId, status: 'waiting' },
      data: { status: 'active', startedAt: new Date() },
    });
    if (!session) throw ApiError.notFound('Session not ready');
    return session;
  }

  // Record tap
  async recordTap(sessionId: string, userId: string, clientTimestamp: number, idempotencyKey: string) {
    const session = await this.prisma.ticketGameSession.findUnique({
      where: { id: sessionId, status: 'active' },
      include: { prize: true },
    });
    if (!session) throw ApiError.notFound('Game not active');

    const now = Date.now();
    const serverStart = new Date(session.startedAt!).getTime();
    const elapsed = now - serverStart;
    const tapMs = clientTimestamp ? clientTimestamp - serverStart : elapsed;

    if (tapMs < MIN_TAP_MS) {
      // Cheat attempt: tap too fast
      await this.prisma.ticketGameSession.update({
        where: { id: sessionId },
        data: { status: 'forfeit', winnerId: userId === session.player1Id ? session.player2Id : session.player1Id },
      });
      throw ApiError.badRequest('Tap too fast – disqualified');
    }

    // Store tap time
    const updateData = userId === session.player1Id
      ? { player1TapMs: tapMs }
      : { player2TapMs: tapMs };
    await this.prisma.ticketGameSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    // If both taps recorded, resolve winner
    const updated = await this.prisma.ticketGameSession.findUnique({ where: { id: sessionId } });
    if (updated?.player1TapMs && updated?.player2TapMs) {
      await this.resolveGame(sessionId);
    }

    return { success: true };
  }

  // Resolve game (determine winner)
  private async resolveGame(sessionId: string) {
    const session = await this.prisma.ticketGameSession.findUnique({
      where: { id: sessionId },
      include: { prize: true, player1: { include: { tier: true } }, player2: { include: { tier: true } } },
    });
    if (!session) throw ApiError.notFound('Session not found');

    const diff = Math.abs((session.player1TapMs || Infinity) - (session.player2TapMs || Infinity));
    let winnerId: string;

    if (diff <= TIE_WINDOW_MS) {
      // Tie break: higher tier wins
      const tierWeight1 = session.player1.tier?.gameWinRate || 10;
      const tierWeight2 = session.player2.tier?.gameWinRate || 10;
      const random = Math.random() * (tierWeight1 + tierWeight2);
      winnerId = random < tierWeight1 ? session.player1Id : session.player2Id;
    } else {
      winnerId = (session.player1TapMs || Infinity) < (session.player2TapMs || Infinity)
        ? session.player1Id
        : session.player2Id;
    }

    // Award prize ticket to winner
    await this.prisma.$transaction(async (tx) => {
      // Create prize redemption
      const prizeCode = randomBytes(8).toString('hex').toUpperCase();
      await tx.prizeRedemption.create({
        data: {
          userId: winnerId,
          prizeId: session.prizeId,
          code: prizeCode,
          status: 'pending',
        },
      });

      // Update session
      await tx.ticketGameSession.update({
        where: { id: sessionId },
        data: { status: 'completed', winnerId, completedAt: new Date() },
      });
    });

    // Note: In production, also emit Socket.IO event 'ticket_game_result'
    console.log(`Ticket game ${sessionId} resolved. Winner: ${winnerId}`);
  }

  // Get session result for polling
  async getResult(sessionId: string) {
    const session = await this.prisma.ticketGameSession.findUnique({
      where: { id: sessionId },
      include: { winner: { select: { id: true, username: true } }, prize: true },
    });
    if (!session) throw ApiError.notFound('Session not found');
    return session;
  }
}