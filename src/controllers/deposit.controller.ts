import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { z } from 'zod';

const createDepositSchema = z.object({
  method: z.enum(['crypto', 'gift_card']),
  cryptoCurrency: z.enum(['BTC', 'ETH', 'USDT_TRC20', 'BNB']).optional(),
  walletAddressUsed: z.string().optional(),
  usdValue: z.number().positive(),
  giftCardBrand: z.string().optional(),
  giftCardDigits: z.string().optional(),
});

export const createDeposit = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) throw ApiError.badRequest('Idempotency-Key required');

  const validated = createDepositSchema.parse(req.body);
  const coinRate = parseInt(process.env.COIN_RATE || '3');
  const coinsToAward = Math.floor(validated.usdValue * coinRate);

  const deposit = await prisma.deposit.create({
    data: {
      userId,
      method: validated.method,
      usdValue: validated.usdValue,
      coinsToAward,
      cryptoCurrency: validated.cryptoCurrency,
      walletAddressUsed: validated.walletAddressUsed,
      giftCardBrand: validated.giftCardBrand,
      giftCardDigits: validated.giftCardDigits,
      status: 'pending',
      idempotencyKey,
    },
  });

  // Emit admin notification via socket
  const io = (global as any).io;
  if (io) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    io.of('/admin').emit('new_deposit', {
      depositId: deposit.id,
      username: user?.username,
      method: deposit.method,
      amount: deposit.usdValue,
    });
  }

  res.status(201).json({ success: true, deposit });
};

export const getDepositAddresses = async (req: Request, res: Response) => {
  const addresses = await prisma.depositAddress.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ success: true, addresses });
};

export const getDepositHistory = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const deposits = await prisma.deposit.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
  const total = await prisma.deposit.count({ where: { userId } });
  res.json({ success: true, deposits, total, page, totalPages: Math.ceil(total / limit) });
};