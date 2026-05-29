// src/services/deposit.service.ts
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ApiError } from '../lib/apiError.js';

export class DepositService {
  constructor(private prisma: PrismaClient) {}

  async createDeposit(
    userId: string,
    method: string,
    data: {
      cryptoCurrency?: string;
      txHash?: string;
      giftCardBrand?: string;
      giftCardDigits?: string;
      giftCardAmountUsd?: number;
    },
    idempotencyKey: string
  ) {
    // Check if deposit already exists with this idempotency key
    const existing = await this.prisma.deposit.findUnique({
      where: { idempotencyKey }
    });

    if (existing) {
      return existing;
    }

    // Create deposit record
    const deposit = await this.prisma.deposit.create({
      data: {
        userId,
        method,
        idempotencyKey,
        cryptoCurrency: data.cryptoCurrency,
        txHash: data.txHash,
        giftCardBrand: data.giftCardBrand,
        giftCardDigits: data.giftCardDigits,
        giftCardAmountUsd: data.giftCardAmountUsd,
        status: 'pending'
      }
    });

    return deposit;
  }

  async getDepositAddresses() {
    return await this.prisma.depositAddress.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
  }

  async getUserDeposits(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const [deposits, total] = await Promise.all([
      this.prisma.deposit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.deposit.count({ where: { userId } })
    ]);

    return {
      deposits,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}