import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { TicketService } from '../services/ticket.service.js';
import { z } from 'zod';

const idempotencyService = new IdempotencyService();
const ticketService = new TicketService(prisma, idempotencyService);

const createListingSchema = z.object({
  listingType: z.enum(['fixed', 'auction']),
  ticketListingId: z.string().uuid().optional(),
  eventName: z.string().optional(),
  eventDate: z.string().datetime().optional(),
  seatInfo: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  askingPriceCoins: z.number().int().positive().optional(),
  startingBidCoins: z.number().int().positive().optional(),
  auctionDurationHours: z.number().int().min(1).max(720).optional(),
  description: z.string().optional(),
  ticketImageUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional()
});

const placeBidSchema = z.object({
  bidCoins: z.number().int().positive()
});

export const getEvents = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const celebrityId = req.query.celebrityId as string;
  const result = await ticketService.getCachedEvents(page, limit, celebrityId);
  res.json({ success: true, ...result });
};

export const getListings = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const type = req.query.type as string;
  const result = await ticketService.getActiveListings(page, limit, type);
  res.json({ success: true, ...result });
};

export const getListing = async (req: Request, res: Response) => {
  const listingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const listing = await ticketService.getListing(listingId);
  res.json({ success: true, listing });
};

export const createListing = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }
  const data = createListingSchema.parse(req.body);
  // Convert eventDate and expiresAt strings to Date objects if provided
  const processedData: any = { ...data };
  if (data.eventDate) processedData.eventDate = new Date(data.eventDate);
  if (data.expiresAt) processedData.expiresAt = new Date(data.expiresAt);
  const listing = await ticketService.createListing(userId, processedData, idempotencyKey);
  res.status(201).json({ success: true, listing });
};

export const buyFixedPrice = async (req: Request, res: Response) => {
  const listingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const buyerId = req.user!.id;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }
  const result = await ticketService.buyFixedPrice(listingId, buyerId, idempotencyKey);
  res.json({ success: true, ...result });
};

export const placeBid = async (req: Request, res: Response) => {
  const listingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const bidderId = req.user!.id;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }
  const { bidCoins } = placeBidSchema.parse(req.body);
  const bid = await ticketService.placeBid(listingId, bidderId, bidCoins, idempotencyKey);
  res.status(201).json({ success: true, bid });
};

export const cancelListing = async (req: Request, res: Response) => {
  const listingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.id;
  await ticketService.cancelListing(listingId, userId);
  res.json({ success: true, message: 'Listing cancelled' });
};

export const getMyListings = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const listings = await ticketService.getUserListings(userId);
  res.json({ success: true, listings });
};

export const getMyPurchases = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const purchases = await ticketService.getUserPurchases(userId);
  res.json({ success: true, purchases });
};