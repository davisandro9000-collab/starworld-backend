import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../services/notification.service.js';

const prisma = new PrismaClient();
const PLATFORM_FEE_PERCENT = 5;

export async function resolveAuction(exchangeId: string) {
  console.log(`🔨 Resolving auction ${exchangeId}...`);

  const listing: any = await prisma.$queryRaw`
    SELECT * FROM ticket_exchanges 
    WHERE id = ${exchangeId}::uuid
      AND listing_type = 'auction' 
      AND status = 'active'
  `;
  if (!listing || listing.length === 0) {
    console.log(`❌ Auction ${exchangeId} not found or not active`);
    return;
  }
  const auction = listing[0];

  const highestBid: any = await prisma.$queryRaw`
    SELECT * FROM ticket_auction_bids 
    WHERE exchange_id = ${exchangeId}::uuid
    ORDER BY bid_coins DESC 
    LIMIT 1
  `;
  if (!highestBid || highestBid.length === 0) {
    await prisma.$executeRaw`
      UPDATE ticket_exchanges SET status = 'expired' WHERE id = ${exchangeId}::uuid
    `;
    console.log(`🏷️ Auction ${exchangeId} expired with no bids`);
    return;
  }
  const winningBid = highestBid[0];
  const feeCoins = Math.floor(winningBid.bid_coins * PLATFORM_FEE_PERCENT / 100);
  const sellerCoins = winningBid.bid_coins - feeCoins;

  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE users SET coin_balance = coin_balance + ${sellerCoins} WHERE id = ${auction.seller_id}::uuid
    `,
    prisma.$executeRaw`
      UPDATE ticket_exchanges 
      SET status = 'sold', buyer_id = ${winningBid.bidder_id}::uuid, sold_at = NOW() 
      WHERE id = ${exchangeId}::uuid
    `,
    prisma.$executeRaw`
      INSERT INTO coin_transactions (user_id, amount, balance_after, type, reference_id, note)
      SELECT ${auction.seller_id}::uuid, ${sellerCoins}, coin_balance, 'ticket_sale', ${exchangeId}::uuid, 'Auction win'
      FROM users WHERE id = ${auction.seller_id}::uuid
    `,
    prisma.$executeRaw`
      UPDATE ticket_auction_bids SET is_winning = true WHERE id = ${winningBid.id}::uuid
    `,
  ]);

  // Send notification and email to winner
  const winner = await prisma.user.findUnique({ where: { id: winningBid.bidder_id } });
  const ticketListing = await prisma.ticketExchange.findUnique({ where: { id: exchangeId } });
  if (winner && ticketListing) {
    const notificationService = new NotificationService(prisma);
    await notificationService.notifyAuctionWin(
      winner.id,
      winner.username,
      winner.email,
      ticketListing.eventName || 'a concert ticket',
      winningBid.bid_coins
    );
  }

  console.log(`✅ Auction ${exchangeId} resolved. Winner: ${winningBid.bidder_id}, bid: ${winningBid.bid_coins} coins`);
}