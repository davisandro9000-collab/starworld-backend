import { PrismaClient } from '@prisma/client';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from './coin.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { v4 as uuidv4 } from 'uuid';   // <-- ensure uuid is installed

const PLATFORM_FEE_PERCENT = 5;

export class TicketService {
  private coinService: CoinService;

  constructor(
    private prisma: PrismaClient,
    idempotencyService: IdempotencyService
  ) {
    this.coinService = new CoinService(prisma, idempotencyService);
  }

  async getCachedEvents(page: number = 1, limit: number = 20, celebrityId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (celebrityId) where.celebrityId = celebrityId;
    const [events, total] = await Promise.all([
      this.prisma.ticketListingCache.findMany({
        where,
        orderBy: { eventDate: 'asc' },
        skip,
        take: limit,
        include: { celebrity: { select: { name: true, slug: true } } },
      }),
      this.prisma.ticketListingCache.count({ where }),
    ]);
    return { events, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createListing(
    sellerId: string,
    data: {
      listingType: 'fixed' | 'auction';
      ticketListingId?: string;
      eventName?: string;
      eventDate?: Date;
      seatInfo?: string;
      quantity: number;
      askingPriceCoins?: number;
      startingBidCoins?: number;
      auctionDurationHours?: number;
      description?: string;
      ticketImageUrl?: string;
      expiresAt?: Date;
    },
    idempotencyKey: string
  ) {
    const seller = await this.prisma.user.findUnique({ where: { id: sellerId } });
    if (!seller) throw ApiError.notFound('Seller not found');
    
    let expiresAt = data.expiresAt;
    if (data.listingType === 'auction' && data.auctionDurationHours) {
      expiresAt = new Date(Date.now() + data.auctionDurationHours * 60 * 60 * 1000);
      if (expiresAt > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
        throw ApiError.badRequest('Auction cannot exceed 30 days');
      }
    } else if (data.listingType === 'fixed') {
      if (!expiresAt) expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    const listing = await this.prisma.ticketExchange.create({
      data: {
        sellerId,
        listingType: data.listingType,
        ticketListingId: data.ticketListingId,
        eventName: data.eventName,
        eventDate: data.eventDate,
        seatInfo: data.seatInfo,
        quantity: data.quantity,
        askingPriceCoins: data.listingType === 'fixed' ? data.askingPriceCoins : null,
        ticketImageUrl: data.ticketImageUrl,
        description: data.description,
        expiresAt: expiresAt!,
        idempotencyKey,
        status: 'active',
      },
    });
    return listing;
  }

  async getActiveListings(page: number = 1, limit: number = 20, type?: string) {
    const skip = (page - 1) * limit;
    const where: any = { status: 'active', expiresAt: { gt: new Date() } };
    if (type) where.listingType = type;
    const [listings, total] = await Promise.all([
      this.prisma.ticketExchange.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          seller: { select: { id: true, username: true, avatarUrl: true } },
          ticketListing: { include: { celebrity: true } },
          auctionBids: {
            orderBy: { bidCoins: 'desc' },
            take: 1,
            include: { bidder: { select: { username: true } } },
          },
        },
      }),
      this.prisma.ticketExchange.count({ where }),
    ]);
    return { listings, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getListing(listingId: string) {
    const listing = await this.prisma.ticketExchange.findUnique({
      where: { id: listingId },
      include: {
        seller: { select: { id: true, username: true, avatarUrl: true } },
        ticketListing: { include: { celebrity: true } },
        auctionBids: {
          orderBy: { bidCoins: 'desc' },
          include: { bidder: { select: { id: true, username: true } } },
        },
      },
    });
    if (!listing) throw ApiError.notFound('Listing not found');
    return listing;
  }

  async buyFixedPrice(listingId: string, buyerId: string, idempotencyKey: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Lock and verify listing
      const listing = await tx.ticketExchange.findUnique({
        where: { id: listingId },
        select: { status: true, listingType: true, askingPriceCoins: true, expiresAt: true, sellerId: true }
      });
      if (!listing) throw ApiError.notFound('Listing not found');
      if (listing.status !== 'active') throw ApiError.badRequest('Listing not active');
      if (listing.listingType !== 'fixed') throw ApiError.badRequest('Not a fixed price listing');
      if (listing.expiresAt < new Date()) throw ApiError.badRequest('Listing expired');
      if (!listing.askingPriceCoins) throw ApiError.badRequest('Invalid listing price');

      const price = listing.askingPriceCoins;
      const feeCoins = Math.floor(price * PLATFORM_FEE_PERCENT / 100);
      const sellerCoins = price - feeCoins;

      // 2. Lock buyer and check balance
      const buyer = await tx.$queryRaw<{ coin_balance: number }[]>`
        SELECT coin_balance FROM users WHERE id = ${buyerId}::uuid FOR UPDATE
      `;
      const buyerBalance = buyer[0]?.coin_balance ?? 0;
      if (buyerBalance < price) throw ApiError.badRequest('Insufficient coins');

      // 3. Lock seller
      const seller = await tx.$queryRaw<{ coin_balance: number }[]>`
        SELECT coin_balance FROM users WHERE id = ${listing.sellerId}::uuid FOR UPDATE
      `;

      // 4. Update buyer balance
      const newBuyerBalance = buyerBalance - price;
      await tx.user.update({
        where: { id: buyerId },
        data: { coinBalance: newBuyerBalance }
      });
      await tx.coinTransaction.create({
        data: {
          userId: buyerId,
          amount: -price,
          balanceAfter: newBuyerBalance,
          type: 'ticket_purchase',
          referenceId: listingId,
          note: `Purchased ticket ${listingId}`,
          idempotencyKey: uuidv4(),   // fixed length
        },
      });

      // 5. Update seller balance
      const sellerBalance = seller[0]?.coin_balance ?? 0;
      const newSellerBalance = sellerBalance + sellerCoins;
      await tx.user.update({
        where: { id: listing.sellerId },
        data: { coinBalance: newSellerBalance }
      });
      await tx.coinTransaction.create({
        data: {
          userId: listing.sellerId,
          amount: sellerCoins,
          balanceAfter: newSellerBalance,
          type: 'ticket_sale',
          referenceId: listingId,
          note: `Sold ticket ${listingId} (fee: ${feeCoins} coins)`,
          idempotencyKey: uuidv4(),
        },
      });

      // 6. Platform fee transaction (record only, no balance change because fee was already deducted from seller)
      if (feeCoins > 0) {
        await tx.coinTransaction.create({
          data: {
            userId: listing.sellerId,
            amount: -feeCoins,
            balanceAfter: newSellerBalance,
            type: 'platform_fee',
            referenceId: listingId,
            note: `Platform fee for ticket ${listingId}`,
            idempotencyKey: uuidv4(),
          },
        });
      }

      // 7. Update listing
      const updatedListing = await tx.ticketExchange.update({
        where: { id: listingId },
        data: { status: 'sold', buyerId, soldAt: new Date() },
      });

      return { listing: updatedListing, buyerBalance: newBuyerBalance, sellerCoins };
    });

    return { success: true, result };
  }

  async placeBid(listingId: string, bidderId: string, bidCoins: number, idempotencyKey: string) {
    const bid = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.ticketExchange.findUnique({
        where: { id: listingId },
        select: { status: true, listingType: true, expiresAt: true, sellerId: true }
      });
      if (!listing) throw ApiError.notFound('Auction not found');
      if (listing.status !== 'active') throw ApiError.badRequest('Auction not active');
      if (listing.listingType !== 'auction') throw ApiError.badRequest('Not an auction');
      if (listing.expiresAt < new Date()) throw ApiError.badRequest('Auction ended');
      if (listing.sellerId === bidderId) throw ApiError.badRequest('Cannot bid on own auction');

      const currentHighestBid = await tx.ticketAuctionBid.findFirst({
        where: { exchangeId: listingId, isWinning: true },
        orderBy: { bidCoins: 'desc' }
      });
      const currentHighest = currentHighestBid?.bidCoins || 0;
      const minIncrement = 5;
      if (bidCoins < currentHighest + minIncrement) {
        throw ApiError.badRequest(`Bid must be at least ${currentHighest + minIncrement} coins`);
      }

      const bidder = await tx.$queryRaw<{ coin_balance: number }[]>`
        SELECT coin_balance FROM users WHERE id = ${bidderId}::uuid FOR UPDATE
      `;
      const bidderBalance = bidder[0]?.coin_balance ?? 0;
      if (bidderBalance < bidCoins) throw ApiError.badRequest('Insufficient coins');

      const newBidderBalance = bidderBalance - bidCoins;
      await tx.user.update({
        where: { id: bidderId },
        data: { coinBalance: newBidderBalance }
      });
      await tx.coinTransaction.create({
        data: {
          userId: bidderId,
          amount: -bidCoins,
          balanceAfter: newBidderBalance,
          type: 'escrow_hold',
          referenceId: listingId,
          note: `Auction bid hold for ${listingId}`,
          idempotencyKey: uuidv4(),
        },
      });

      const newBid = await tx.ticketAuctionBid.create({
        data: {
          exchangeId: listingId,
          bidderId,
          bidCoins,
          isWinning: true,
          coinsReserved: true,
          idempotencyKey: uuidv4(),
        },
      });

      if (currentHighestBid && currentHighestBid.bidderId !== bidderId) {
        await tx.ticketAuctionBid.update({
          where: { id: currentHighestBid.id },
          data: { isWinning: false },
        });
        if (currentHighestBid.coinsReserved) {
          const prevBidder = await tx.$queryRaw<{ coin_balance: number }[]>`
            SELECT coin_balance FROM users WHERE id = ${currentHighestBid.bidderId}::uuid FOR UPDATE
          `;
          const prevBalance = prevBidder[0]?.coin_balance ?? 0;
          const newPrevBalance = prevBalance + currentHighestBid.bidCoins;
          await tx.user.update({
            where: { id: currentHighestBid.bidderId },
            data: { coinBalance: newPrevBalance }
          });
          await tx.coinTransaction.create({
            data: {
              userId: currentHighestBid.bidderId,
              amount: currentHighestBid.bidCoins,
              balanceAfter: newPrevBalance,
              type: 'escrow_release',
              referenceId: listingId,
              note: `Bid outbid - escrow released for ${listingId}`,
              idempotencyKey: uuidv4(),
            },
          });
        }
      }

      return newBid;
    });

    // Socket.IO real-time update
    const io = (global as any).io;
    if (io) {
      const updatedListing = await this.prisma.ticketExchange.findUnique({
        where: { id: listingId },
        select: { expiresAt: true }
      });
      io.of('/user').to(`auction:${listingId}`).emit('auction_update', {
        exchangeId: listingId,
        currentBid: bidCoins,
        timeRemaining: Math.max(0, updatedListing!.expiresAt.getTime() - Date.now()),
      });
    }

    return bid;
  }

  async getUserListings(userId: string) {
    return this.prisma.ticketExchange.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { buyer: { select: { username: true } }, auctionBids: { take: 1, orderBy: { bidCoins: 'desc' } } },
    });
  }

  async getUserPurchases(userId: string) {
    return this.prisma.ticketExchange.findMany({
      where: { buyerId: userId, status: 'sold' },
      orderBy: { soldAt: 'desc' },
    });
  }

  async cancelListing(listingId: string, sellerId: string) {
    const listing = await this.prisma.ticketExchange.findFirst({
      where: { id: listingId, sellerId, status: 'active', expiresAt: { gt: new Date() } },
    });
    if (!listing) throw ApiError.notFound('Listing not found or cannot cancel');
    await this.prisma.ticketExchange.update({ where: { id: listingId }, data: { status: 'cancelled' } });
    return { success: true };
  }

  async getFlaggedListings() {
    return this.prisma.ticketExchange.findMany({
      where: { status: 'active', description: { contains: 'flag' } },
      include: { seller: true },
    });
  }

  async removeFlaggedListing(listingId: string, reason: string) {
    return this.prisma.ticketExchange.update({
      where: { id: listingId },
      data: { status: 'cancelled' },
    });
  }
}