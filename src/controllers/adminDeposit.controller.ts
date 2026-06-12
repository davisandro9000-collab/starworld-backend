import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from '../services/coin.service.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { TierService } from '../services/tier.service.js';
import { ReferralService } from '../services/referral.service.js';
import { NotificationService } from '../services/notification.service.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const idempotencyService = new IdempotencyService();
const coinService = new CoinService(prisma, idempotencyService);
const tierService = new TierService(prisma);
const referralService = new ReferralService(prisma, idempotencyService);
const notificationService = new NotificationService(prisma);

const creditDepositSchema = z.object({
  coinsToAward: z.number().min(1),
  usdValue: z.number().min(0.01).optional(),
});

function getParamId(param: string | string[] | undefined): string {
  if (!param) throw new Error('Missing parameter');
  return Array.isArray(param) ? param[0] : param;
}

async function runTransactionWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 500
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.message?.includes('Unable to start a transaction') && i < maxRetries - 1) {
        console.log(`Transaction retry ${i + 1}/${maxRetries} after ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Transaction failed after retries');
}

export const getPendingDeposits = async (req: Request, res: Response) => {
  const deposits = await prisma.deposit.findMany({
    where: { status: 'pending' },
    include: { user: { select: { id: true, username: true, email: true, tier: true } } },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ success: true, deposits });
};

export const getPendingCount = async (req: Request, res: Response) => {
  const count = await prisma.deposit.count({ where: { status: 'pending' } });
  res.json({ success: true, count });
};

export const creditDeposit = async (req: Request, res: Response) => {
  const depositId = getParamId(req.params.depositId);
  const adminId = req.admin!.id;
  const idempotencyKey = req.idempotencyKey;
  const { usdValue, coinsToAward } = creditDepositSchema.parse(req.body);

  const { executed, result } = await idempotencyService.process(
    idempotencyKey,
    86400,
    async () => {
      return await runTransactionWithRetry(async () => {
        return await prisma.$transaction(async (tx) => {
          const deposit = await tx.deposit.findUnique({
            where: { id: depositId },
            select: { status: true, userId: true, usdValue: true }
          });
          if (!deposit) throw ApiError.notFound('Deposit not found');
          if (deposit.status !== 'pending') {
            throw ApiError.badRequest(`Deposit already ${deposit.status}`);
          }

          let finalUsdValue = usdValue ?? deposit.usdValue;
          if (!finalUsdValue) {
            // Fallback: calculate from coinsToAward using coin rate
            const coinRate = parseInt(process.env.COIN_RATE || '3');
            finalUsdValue = coinsToAward / coinRate;
          }

          const updatedDeposit = await tx.deposit.update({
            where: { id: depositId },
            data: {
              usdValue: finalUsdValue,
              coinsToAward,
              status: 'credited',
              verifiedById: adminId,
              verifiedAt: new Date(),
              idempotencyKey
            }
          });

          const users = await tx.$queryRaw<{ coin_balance: number }[]>`
            SELECT coin_balance FROM users WHERE id = ${updatedDeposit.userId}::uuid FOR UPDATE
          `;
          const currentBalance = users[0]?.coin_balance ?? 0;
          const newBalance = currentBalance + coinsToAward;

          await tx.user.update({
            where: { id: updatedDeposit.userId },
            data: { coinBalance: newBalance }
          });

          await tx.coinTransaction.create({
            data: {
              userId: updatedDeposit.userId,
              amount: coinsToAward,
              balanceAfter: newBalance,
              type: 'admin_grant',
              referenceId: updatedDeposit.id,
              note: `Deposit credit: $${finalUsdValue} = ${coinsToAward} coins`,
              idempotencyKey: idempotencyKey || undefined
            }
          });

          return updatedDeposit;
        });
      });
    }
  );

  if (!executed) {
    return res.json({
      success: true,
      deposit: result,
      idempotent: true,
      message: 'Deposit already credited'
    });
  }

  const deposit = result;

  // Side effects
  try {
    await referralService.activateReferral(deposit.userId, uuidv4());
    await tierService.checkAndUpgradeTier(deposit.userId);
    const user = await prisma.user.findUnique({ where: { id: deposit.userId } });
    if (user) {
      const usdValueNum = deposit.usdValue ? Number(deposit.usdValue) : 0;
      await notificationService.notifyDepositCredited(
        user.id, user.username, user.email, usdValueNum, coinsToAward
      );
    }
    if ((global as any).io) {
      (global as any).io.of('/user').to(`user:${deposit.userId}`).emit('notification', {
        type: 'deposit_credited',
        title: 'Deposit Verified!',
        body: `$${deposit.usdValue} added → ${coinsToAward} coins credited`
      });
      (global as any).io.of('/user').to(`user:${deposit.userId}`).emit('coin_update', { newBalance: user?.coinBalance });
    }
  } catch (sideError) {
    console.error('Side effects failed:', sideError);
  }

  res.json({ success: true, deposit, idempotent: false });
};

export const rejectDeposit = async (req: Request, res: Response) => {
  const depositId = getParamId(req.params.depositId);
  const adminId = req.admin!.id;
  const { reason } = req.body;
  if (!reason) throw ApiError.badRequest('Rejection reason required');

  const deposit = await prisma.deposit.update({
    where: { id: depositId, status: 'pending' },
    data: {
      status: 'rejected',
      verifiedById: adminId,
      verifiedAt: new Date(),
      rejectionReason: reason
    }
  });
  if (!deposit) throw ApiError.notFound('Deposit not found or already processed');
  res.json({ success: true, deposit });
};

export const getDepositHistory = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const skip = (page - 1) * limit;
  const where: any = {};
  if (status && status !== 'all') where.status = status;

  const [deposits, total] = await Promise.all([
    prisma.deposit.findMany({
      where,
      include: {
        user: { select: { username: true, email: true } },
        verifiedBy: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.deposit.count({ where })
  ]);
  res.json({ success: true, deposits, total, page, totalPages: Math.ceil(total / limit) });
};