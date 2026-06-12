// src/controllers/adminFootballTicket.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

export const createTicketListing = async (req: Request, res: Response) => {
  const { matchId, priceCoins, seatInfo, ticketImageUrl, expiresAt } = req.body;
  const match = await prisma.footballMatch.findUnique({ where: { id: matchId } });
  if (!match) throw ApiError.notFound('Match not found');
  
  // If admin user is not available, use a fallback admin ID (first admin in DB)
  let sellerId = req.admin?.id;
  if (!sellerId) {
    const firstAdmin = await prisma.adminUser.findFirst();
    sellerId = firstAdmin?.id;
    if (!sellerId) throw ApiError.internal('No admin user found');
  }
  
  const listing = await prisma.footballTicketListing.create({
    data: {
      matchId,
      priceCoins,
      seatInfo,
      ticketImageUrl,
      expiresAt: new Date(expiresAt),
      sellerId,
    },
  });
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
  res.json({ success: true });
};