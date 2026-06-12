// src/controllers/footballTicketResale.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from '../services/coin.service.js';
import { IdempotencyService } from '../services/idempotency.service.js';

const idempotency = new IdempotencyService();
const coinService = new CoinService(prisma, idempotency);

export const getListingsForMatch = async (req: Request, res: Response) => {
  const matchId = String(req.params.matchId);
  const listings = await prisma.footballTicketListing.findMany({
    where: { matchId, status: 'active', expiresAt: { gt: new Date() } },
    include: { seller: { select: { username: true } } },
    orderBy: { priceCoins: 'asc' },
  });
  res.json({ success: true, listings });
};

export const buyListing = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { listingId } = req.body;
  const idempotencyKey = req.headers['idempotency-key'] as string;
  if (!idempotencyKey) throw ApiError.badRequest('Idempotency-Key required');

  const listing = await prisma.footballTicketListing.findUnique({
    where: { id: listingId, status: 'active' },
  });
  if (!listing) throw ApiError.notFound('Listing not found or expired');
  if (listing.expiresAt < new Date()) throw ApiError.badRequest('Listing expired');

  const result = await coinService.deductCoins(userId, listing.priceCoins, 'ticket_purchase', listing.id, `Buy football ticket`, idempotencyKey);
  if (!result.success) throw ApiError.badRequest('Insufficient coins');

  await prisma.footballTicketListing.update({
    where: { id: listingId },
    data: { status: 'sold', buyerId: userId, soldAt: new Date() },
  });
  res.json({ success: true });
};