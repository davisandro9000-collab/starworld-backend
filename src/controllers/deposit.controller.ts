import { Request, Response } from 'express';
import { DepositService } from '../services/deposit.service.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { z } from 'zod';

const depositService = new DepositService(prisma);

const createDepositSchema = z.object({
  method: z.enum(['crypto', 'gift_card']),
  cryptoCurrency: z.enum(['BTC', 'ETH', 'USDT_TRC20', 'BNB']).optional(),
  txHash: z.string().optional(),
  giftCardBrand: z.string().optional(),
  giftCardDigits: z.string().optional(),
  giftCardAmountUsd: z.number().optional()
});

export const createDeposit = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) {
    throw ApiError.badRequest('Idempotency-Key header required');
  }

  const validated = createDepositSchema.parse(req.body);

  const deposit = await depositService.createDeposit(
    userId,
    validated.method,
    validated,
    idempotencyKey
  );

  // Emit admin notification via Socket.IO
  const io = (global as any).io;
  if (io) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    io.of('/admin').emit('new_deposit', {
      depositId: deposit.id,
      username: user?.username,
      method: deposit.method,
      amount: deposit.giftCardAmountUsd || deposit.cryptoCurrency || 'crypto',
    });
  }

  res.status(201).json({ success: true, deposit });
};

export const getDepositAddresses = async (req: Request, res: Response) => {
  const addresses = await depositService.getDepositAddresses();
  res.json({ success: true, addresses });
};

export const getDepositHistory = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const result = await depositService.getUserDeposits(userId, page, limit);
  res.json({ success: true, ...result });
};