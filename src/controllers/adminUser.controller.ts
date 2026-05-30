// src/controllers/adminUser.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { v4 as uuidv4 } from 'uuid';   // <-- ADD THIS IMPORT

// Helper to get a single string from req.params
function getParamId(param: string | string[] | undefined): string {
  if (!param) throw new Error('Missing parameter');
  return Array.isArray(param) ? param[0] : param;
}

export const getUsers = async (req: Request, res: Response) => {
  const { email, username, page = 1, limit = 20 } = req.query;
  const where: any = {};
  if (email) where.email = { contains: email as string, mode: 'insensitive' };
  if (username) where.username = { contains: username as string, mode: 'insensitive' };
  
  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { tier: true },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);
  
  res.json({ success: true, users, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
};

export const getUserById = async (req: Request, res: Response) => {
  const userId = getParamId(req.params.userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { 
      tier: true, 
      deposits: { take: 10, orderBy: { createdAt: 'desc' } },
      coinTransactions: { take: 10, orderBy: { createdAt: 'desc' } }
    }
  });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, user });
};

export const grantCoinsToUser = async (req: Request, res: Response) => {
  const userId = getParamId(req.params.userId);
  const { amount, reason } = req.body;
  const adminId = req.admin.id;
  
  if (!amount || amount <= 0) {
    throw ApiError.badRequest('Amount must be a positive number');
  }
  
  const result = await prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ coin_balance: number }[]>`
      SELECT coin_balance FROM users WHERE id = ${userId}::uuid FOR UPDATE
    `;
    const currentBalance = users[0]?.coin_balance ?? 0;
    const newBalance = currentBalance + amount;
    
    await tx.user.update({
      where: { id: userId },
      data: { coinBalance: newBalance }
    });
    
    await tx.coinTransaction.create({
      data: {
        userId,
        amount,
        balanceAfter: newBalance,
        type: 'admin_grant',
        note: reason || `Admin grant by ${adminId}`,
        idempotencyKey: uuidv4(),   // ✅ fixed: UUID length 36 chars
      }
    });
    
    return { newBalance };
  });
  
  res.json({ success: true, newBalance: result.newBalance });
};

export const setUserTier = async (req: Request, res: Response) => {
  const userId = getParamId(req.params.userId);
  const { tierId } = req.body;
  
  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier) throw ApiError.notFound('Tier not found');
  
  const user = await prisma.user.update({
    where: { id: userId },
    data: { tierId }
  });
  
  res.json({ success: true, user });
};

export const banUser = async (req: Request, res: Response) => {
  const userId = getParamId(req.params.userId);
  const { reason } = req.body;
  
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true, banReason: reason || 'Banned by admin' }
  });
  res.json({ success: true, user });
};

export const unbanUser = async (req: Request, res: Response) => {
  const userId = getParamId(req.params.userId);
  
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: false, banReason: null }
  });
  res.json({ success: true, user });
};