// src/controllers/adminTicket.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { resolveAuction } from '../jobs/auctionResolve.job.js';

// Existing: get flagged listings
export const getFlaggedListings = async (req: Request, res: Response) => {
  const listings = await prisma.ticketExchange.findMany({
    where: { status: 'active', description: { contains: 'flag' } },
    include: { seller: true },
  });
  res.json({ success: true, listings });
};

// Existing: remove flagged listing
export const removeFlaggedListing = async (req: Request, res: Response) => {
  const listingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { reason } = req.body;
  if (!reason) throw new Error('Reason required');
  const listing = await prisma.ticketExchange.update({
    where: { id: listingId },
    data: { status: 'cancelled' },
  });
  res.json({ success: true, listing });
};

// Existing: resolve all expired auctions (bulk)
export const resolveExpiredAuctions = async (req: Request, res: Response) => {
  const now = new Date();
  const expired = await prisma.ticketExchange.findMany({
    where: {
      listingType: 'auction',
      status: 'active',
      expiresAt: { lt: now },
    },
    select: { id: true },
  });
  console.log(`Found ${expired.length} expired auctions to resolve`);
  for (const auction of expired) {
    await resolveAuction(auction.id);
  }
  res.json({ success: true, resolved: expired.length });
};

// NEW: force-resolve a single auction by ID (manual override)
export const forceResolveAuction = async (req: Request, res: Response) => {
  const auctionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  // Find the highest bid
  const highestBid = await prisma.ticketAuctionBid.findFirst({
    where: { exchangeId: auctionId },
    orderBy: { bidCoins: 'desc' },
  });

  if (!highestBid) {
    return res.status(400).json({ error: 'No bids on this auction' });
  }

  // Update auction to sold
  await prisma.ticketExchange.update({
    where: { id: auctionId },
    data: {
      status: 'sold',
      buyerId: highestBid.bidderId,
      soldAt: new Date(),
    },
  });

  // Mark the winning bid
  await prisma.ticketAuctionBid.update({
    where: { id: highestBid.id },
    data: { isWinning: true },
  });

  res.json({
    success: true,
    message: `Auction ${auctionId} resolved. Winner: ${highestBid.bidderId}, bid: ${highestBid.bidCoins} coins`,
  });
};