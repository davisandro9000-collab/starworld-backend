import { PrismaClient } from '@prisma/client';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from './coin.service.js';
import { IdempotencyService } from './idempotency.service.js';

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
    // Auction resolution is handled by global interval resolver in index.ts
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
    const listing = await this.prisma.ticketExchange.findUnique({
      where: { id: listingId, status: 'active', listingType: 'fixed' },
    });
    if (!listing) throw ApiError.notFound('Listing not found or already sold');
    if (listing.expiresAt < new Date()) throw ApiError.badRequest('Listing expired');
    if (!listing.askingPriceCoins) throw ApiError.badRequest('Invalid listing price');
    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer) throw ApiError.notFound('Buyer not found');
    if (buyer.coinBalance < listing.askingPriceCoins) throw ApiError.badRequest('Insufficient coins');
    const feeCoins = Math.floor(listing.askingPriceCoins * PLATFORM_FEE_PERCENT / 100);
    const sellerCoins = listing.askingPriceCoins - feeCoins;
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedBuyer = await tx.user.update({
        where: { id: buyerId },
        data: { coinBalance: { decrement: listing.askingPriceCoins } },
      });
      await tx.coinTransaction.create({
        data: {
          userId: buyerId,
          amount: -listing.askingPriceCoins,
          balanceAfter: updatedBuyer.coinBalance,
          type: 'ticket_purchase',
          referenceId: listing.id,
          note: `Purchased ticket ${listing.id}`,
          idempotencyKey,
        },
      });
      const updatedSeller = await tx.user.update({
        where: { id: listing.sellerId },
        data: { coinBalance: { increment: sellerCoins } },
      });
      await tx.coinTransaction.create({
        data: {
          userId: listing.sellerId,
          amount: sellerCoins,
          balanceAfter: updatedSeller.coinBalance,
          type: 'ticket_sale',
          referenceId: listing.id,
          note: `Sold ticket ${listing.id} (fee: ${feeCoins} coins)`,
          idempotencyKey: idempotencyKey + '_seller',
        },
      });
      if (feeCoins > 0) {
        await tx.coinTransaction.create({
          data: {
            userId: listing.sellerId,
            amount: -feeCoins,
            balanceAfter: updatedSeller.coinBalance,
            type: 'platform_fee',
            referenceId: listing.id,
            note: `Platform fee for ticket ${listing.id}`,
            idempotencyKey: idempotencyKey + '_fee',
          },
        });
      }
      const updatedListing = await tx.ticketExchange.update({
        where: { id: listingId },
        data: { status: 'sold', buyerId, soldAt: new Date() },
      });
      return { listing: updatedListing, buyerBalance: updatedBuyer.coinBalance, sellerCoins };
    });
    return { success: true, result };
  }

  // ----- PLACE BID (with Socket.IO emission) -----
  async placeBid(listingId: string, bidderId: string, bidCoins: number, idempotencyKey: string) {
    const listing = await this.prisma.ticketExchange.findUnique({
      where: { id: listingId, status: 'active', listingType: 'auction' },
      include: { auctionBids: { orderBy: { bidCoins: 'desc' }, take: 1 } },
    });
    if (!listing) throw ApiError.notFound('Auction not found or not active');
    if (listing.expiresAt < new Date()) throw ApiError.badRequest('Auction ended');
    if (listing.sellerId === bidderId) throw ApiError.badRequest('Cannot bid on own auction');

    const currentHighest = listing.auctionBids[0]?.bidCoins || 0;
    const minIncrement = 5;
    if (bidCoins < currentHighest + minIncrement) {
      throw ApiError.badRequest(`Bid must be at least ${currentHighest + minIncrement} coins`);
    }

    const bidder = await this.prisma.user.findUnique({ where: { id: bidderId } });
    if (!bidder) throw ApiError.notFound('Bidder not found');
    if (bidder.coinBalance < bidCoins) throw ApiError.badRequest('Insufficient coins');

    await this.coinService.deductCoins(bidderId, bidCoins, 'escrow_hold', listingId, 'Auction bid hold', idempotencyKey);

    const bid = await this.prisma.ticketAuctionBid.create({
      data: {
        exchangeId: listingId,
        bidderId,
        bidCoins,
        isWinning: true,
        coinsReserved: true,
        idempotencyKey,
      },
    });

    const previousWinning = listing.auctionBids[0];
    if (previousWinning) {
      await this.prisma.ticketAuctionBid.update({
        where: { id: previousWinning.id },
        data: { isWinning: false },
      });
      if (previousWinning.coinsReserved) {
        await this.coinService.grantCoins(previousWinning.bidderId, previousWinning.bidCoins, 'escrow_release', listingId, 'Bid outbid', idempotencyKey + '_release');
      }
    }

    // Emit real‑time auction update
    const io = (global as any).io;
    if (io) {
      const updatedListing = await this.prisma.ticketExchange.findUnique({
        where: { id: listingId },
        select: { expiresAt: true }
      });
      io.of('/user').to(`auction:${listingId}`).emit('auction_update', {
        exchangeId: listingId,
        currentBid: bidCoins,
        leader: bidderId,
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