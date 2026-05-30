// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { TierService } from '../services/tier.service.js';
import { ApiError } from '../lib/apiError.js';

const tierService = new TierService(prisma);

// Helper to get a single string from req.params
function getParamId(param: string | string[] | undefined): string {
  if (!param) throw new Error('Missing parameter');
  return Array.isArray(param) ? param[0] : param;
}

export const getCurrentUser = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { tier: true }
  });
  if (!user) throw ApiError.notFound('User not found');
  
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coinBalance: user.coinBalance,
    tier: user.tier,
    payoutUnlocked: user.payoutUnlocked,
    totalReferrals: user.totalReferrals,
    createdAt: user.createdAt
  });
};

export const getUserBalance = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { coinBalance: true, tier: true }
  });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ balance: user.coinBalance, tier: user.tier });
};

export const updateProfile = async (req: Request, res: Response) => {
  const { displayName, avatarUrl } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { displayName, avatarUrl }
  });
  res.json({ success: true, user });
};

export const getTierInfo = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const tierInfo = await tierService.getUserTierInfo(userId);
  
  res.json({
    success: true,
    ...tierInfo
  });
};

export const getNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  const notifications = await prisma.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit
  });
  
  const total = await prisma.userNotification.count({ where: { userId } });
  
  res.json({
    success: true,
    notifications,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const notificationId = getParamId(req.params.notificationId);
  
  await prisma.userNotification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true }
  });
  
  res.json({ success: true });
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  await prisma.userNotification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
  
  res.json({ success: true });
};