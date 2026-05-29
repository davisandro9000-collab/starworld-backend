import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { resolveAuction } from './auctionResolve.job.js';

const prisma = new PrismaClient();

export function startAuctionCron() {
  // Immediate check (5 seconds after startup)
  setTimeout(async () => {
    console.log('🕐 Initial check for expired auctions...');
    const now = new Date(); // JavaScript Date (UTC)
    const expiredAuctions = await prisma.ticketExchange.findMany({
      where: {
        listingType: 'auction',
        status: 'active',
        expiresAt: { lt: now },
      },
      select: { id: true },
    });
    console.log(`Found ${expiredAuctions.length} expired auctions`);
    for (const auction of expiredAuctions) {
      console.log(`🔨 Resolving expired auction ${auction.id} via initial check`);
      await resolveAuction(auction.id);
    }
  }, 5000);

  // Scheduled run every minute
  cron.schedule('* * * * *', async () => {
    console.log('🕐 Cron tick: checking for expired auctions...');
    const now = new Date();
    const expiredAuctions = await prisma.ticketExchange.findMany({
      where: {
        listingType: 'auction',
        status: 'active',
        expiresAt: { lt: now },
      },
      select: { id: true },
    });
    console.log(`Found ${expiredAuctions.length} expired auctions`);
    for (const auction of expiredAuctions) {
      console.log(`🔨 Resolving expired auction ${auction.id} via cron`);
      await resolveAuction(auction.id);
    }
  });

  console.log('⏰ Auction cron started (runs every minute, plus initial check)');
}