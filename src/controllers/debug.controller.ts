import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const createCashPrize = async (req: Request, res: Response) => {
  const prize = await prisma.prize.create({
    data: {
      label: '$10 Cash',
      type: 'cash',
      isActive: true,
    },
  });
  res.json({ success: true, prize });
};

export const createOfferForUser = async (req: Request, res: Response) => {
  const { userId, prizeId, wagerCoins } = req.body;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const offer = await prisma.ticketGameOffer.create({
    data: {
      userId,
      prizeId,
      wagerCoins,
      expiresAt,
      status: 'pending',
    },
  });
  res.json({ success: true, offer });
};

export const seedDepositAddresses = async (req: Request, res: Response) => {
  const addresses = [
    { method: 'BTC', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', sortOrder: 1 },
    { method: 'ETH', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6', sortOrder: 2 },
    { method: 'USDT_TRC20', address: 'TQYxY9aJgYxYxYxYxYxYxYxYxYxYxYxYxY', sortOrder: 3 },
    { method: 'BNB', address: 'bnb1xqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqx', sortOrder: 4 },
    { method: 'amazon', address: null, sortOrder: 5 },
    { method: 'google_play', address: null, sortOrder: 6 },
    { method: 'apple', address: null, sortOrder: 7 },
    { method: 'steam', address: null, sortOrder: 8 },
  ];

  for (const addr of addresses) {
    const existing = await prisma.depositAddress.findFirst({
      where: { method: addr.method },
    });
    if (!existing) {
      await prisma.depositAddress.create({
        data: {
          method: addr.method,
          address: addr.address,
          isActive: true,
          sortOrder: addr.sortOrder,
        },
      });
    }
  }
  res.json({ success: true, message: 'Deposit addresses seeded' });
};

// NEW: seed celebrities
export const seedCelebrities = async (req: Request, res: Response) => {
  const celebrities = [
    { name: 'Taylor Swift', slug: 'taylor-swift', bio: 'Grammy-winning singer-songwriter', isPublished: true },
    { name: 'Drake', slug: 'drake', bio: 'Multi-platinum recording artist', isPublished: true },
    { name: 'Beyoncé', slug: 'beyonce', bio: 'Iconic singer and performer', isPublished: true },
    { name: 'The Weeknd', slug: 'the-weeknd', bio: 'Award-winning R&B artist', isPublished: true },
    { name: 'Bad Bunny', slug: 'bad-bunny', bio: 'Latin trap and reggaeton superstar', isPublished: true },
  ];

  for (const celeb of celebrities) {
    await prisma.celebrity.upsert({
      where: { slug: celeb.slug },
      update: {},
      create: {
        name: celeb.name,
        slug: celeb.slug,
        bio: celeb.bio,
        isPublished: celeb.isPublished,
      },
    });
  }
  res.json({ success: true, message: 'Celebrities seeded' });
};