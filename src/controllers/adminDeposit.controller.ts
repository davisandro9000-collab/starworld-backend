import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { CoinService } from '../services/coin.service.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { TierService } from '../services/tier.service.js';
import { ReferralService } from '../services/referral.service.js';
import { NotificationService } from '../services/notification.service.js';
import { z } from 'zod';

const idempotencyService = new IdempotencyService();
const coinService = new CoinService(prisma, idempotencyService);
const tierService = new TierService(prisma);
const referralService = new ReferralService(prisma, idempotencyService);
const notificationService = new NotificationService(prisma);

const creditDepositSchema = z.object({
  usdValue: z.number().min(0.01),
  coinsToAward: z.number().min(1)
});

export const getPendingDeposits = async (req: Request, res: Response) => {
  const deposits = await prisma.deposit.findMany({
    where: { status: 'pending' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          tier: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ success: true, deposits });
};

export const getPendingCount = async (req: Request, res: Response) => {
  const count = await prisma.deposit.count({
    where: { status: 'pending' }
  });
  res.json({ success: true, count });
};

export const creditDeposit = async (req: Request, res: Response) => {
  const depositId = Array.isArray(req.params.depositId) ? req.params.depositId[0] : req.params.depositId;
  const adminId = req.admin!.id;
  const idempotencyKey = req.idempotencyKey;
  const { usdValue, coinsToAward } = creditDepositSchema.parse(req.body);

  const existing = await prisma.deposit.findFirst({
    where: { id: depositId, status: 'credited' }
  });
  if (existing) {
    return res.json({ success: true, deposit: existing, idempotent: true, message: 'Deposit already credited' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const deposit = await tx.deposit.update({
      where: { id: depositId, status: 'pending' },
      data: {
        usdValue,
        coinsToAward,
        status: 'credited',
        verifiedById: adminId,
        verifiedAt: new Date(),
        idempotencyKey
      }
    });
    if (!deposit) throw ApiError.notFound('Deposit not found or already processed');

    const user = await tx.user.findUnique({
      where: { id: deposit.userId },
      select: { coinBalance: true }
    });
    if (!user) throw ApiError.notFound('User not found');

    const newBalance = user.coinBalance + coinsToAward;
    await tx.user.update({
      where: { id: deposit.userId },
      data: { coinBalance: newBalance }
    });
    await tx.coinTransaction.create({
      data: {
        userId: deposit.userId,
        amount: coinsToAward,
        balanceAfter: newBalance,
        type: 'admin_grant',
        referenceId: deposit.id,
        note: `Deposit credit: $${usdValue} = ${coinsToAward} coins`,
        idempotencyKey: idempotencyKey || undefined
      }
    });
    return deposit;
  });

  // Activate referral if applicable
  await referralService.activateReferral(result.userId, `${idempotencyKey}_referral`);
  // Check tier upgrade
  await tierService.checkAndUpgradeTier(result.userId);
  // Send notification and email
  const user = await prisma.user.findUnique({ where: { id: result.userId } });
  if (user) {
    await notificationService.notifyDepositCredited(user.id, user.username, user.email, usdValue, coinsToAward);
  }

  res.json({ success: true, deposit: result, idempotent: false });
};

export const rejectDeposit = async (req: Request, res: Response) => {
  const depositId = Array.isArray(req.params.depositId) ? req.params.depositId[0] : req.params.depositId;
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