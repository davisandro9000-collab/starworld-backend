// src/controllers/adminFootballTicket.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

export const createTicketListing = async (req: Request, res: Response) => {
  const { matchId, priceCoins, seatInfo, ticketImageUrl, expiresAt } = req.body;
  
  // Validate match
  const match = await prisma.footballMatch.findUnique({
    where: { id: matchId },
  });
  if (!match) throw ApiError.notFound('Match not found');
  
  // Parse expiresAt – ensure it's a valid date
  const expiresAtDate = new Date(expiresAt);
  if (isNaN(expiresAtDate.getTime())) {
    console.error('❌ Invalid expiresAt:', expiresAt);
    throw ApiError.badRequest('Invalid expiresAt date');
  }
  
  // Get seller ID (admin)
  let sellerId: string;
  if (req.admin?.id) {
    sellerId = req.admin.id;
  } else {
    const adminUser = await prisma.adminUser.findFirst();
    if (!adminUser) throw ApiError.internal('No admin user found');
    sellerId = adminUser.id;
  }
  
  const listing = await prisma.footballTicketListing.create({
    data: {
      matchId,
      priceCoins,
      seatInfo,
      ticketImageUrl,
      expiresAt: expiresAtDate,
      sellerId,
      status: 'active',
    },
  });
  
  console.log(`✅ Ticket listing created: ${listing.id} for match ${matchId}`);
  res.status(201).json({ success: true, listing });
};

export const getListings = async (req: Request, res: Response) => {
  const listings = await prisma.footballTicketListing.findMany({
    include: { match: { include: { homeTeam: true, awayTeam: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, listings });
};

export const cancelListing = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await prisma.footballTicketListing.update({
    where: { id },
    data: { status: 'cancelled' },
  });
  res.json({ success: true, listing: { id, status: 'cancelled' } });
};