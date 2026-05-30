// src/controllers/adminAnalytics.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const getDailyActiveUsers = async (req: Request, res: Response) => {
  const { days = 30 } = req.query;
  const limit = parseInt(days as string);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - limit);

  const result = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as count
    FROM game_sessions
    WHERE created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  // Convert bigint to number
  const data = result.map(row => ({ date: row.date, count: Number(row.count) }));
  res.json({ success: true, data });
};

export const getTotalCoinsIssued = async (req: Request, res: Response) => {
  const { period = '30d' } = req.query;
  let startDate = new Date();
  if (period === '24h') startDate.setHours(startDate.getHours() - 24);
  else if (period === '7d') startDate.setDate(startDate.getDate() - 7);
  else if (period === '30d') startDate.setDate(startDate.getDate() - 30);
  else startDate = new Date(0); // all time

  const result = await prisma.coinTransaction.aggregate({
    where: {
      type: { in: ['admin_grant', 'game_win', 'referral_bonus'] },
      createdAt: { gte: startDate }
    },
    _sum: { amount: true }
  });
  const totalCoins = result._sum.amount ? Number(result._sum.amount) : 0;
  res.json({ success: true, totalCoins, period });
};

export const getDepositVolume = async (req: Request, res: Response) => {
  const { period = '30d' } = req.query;
  let startDate = new Date();
  if (period === '24h') startDate.setHours(startDate.getHours() - 24);
  else if (period === '7d') startDate.setDate(startDate.getDate() - 7);
  else if (period === '30d') startDate.setDate(startDate.getDate() - 30);
  else startDate = new Date(0);

  const result = await prisma.deposit.aggregate({
    where: {
      status: 'credited',
      createdAt: { gte: startDate }
    },
    _sum: { usdValue: true }
  });
  const totalUsd = result._sum.usdValue ? Number(result._sum.usdValue) : 0;
  res.json({ success: true, totalUsd, period });
};

export const getGameWinRates = async (req: Request, res: Response) => {
  const result = await prisma.$queryRaw<{ gameType: string; totalGames: bigint; wins: bigint; winRate: number }[]>`
    SELECT 
      game_type as "gameType",
      COUNT(*) as "totalGames",
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
      ROUND(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2) as "winRate"
    FROM game_sessions
    GROUP BY game_type
  `;
  const data = result.map(row => ({
    gameType: row.gameType,
    totalGames: Number(row.totalGames),
    wins: Number(row.wins),
    winRate: row.winRate
  }));
  res.json({ success: true, data });
};

export const getTopPerformers = async (req: Request, res: Response) => {
  const { limit = 10 } = req.query;
  const parsedLimit = parseInt(limit as string);
  const result = await prisma.$queryRaw<{ userId: string; username: string; totalCoins: bigint }[]>`
    SELECT 
      u.id as "userId",
      u.username,
      SUM(ct.amount) as "totalCoins"
    FROM coin_transactions ct
    JOIN users u ON u.id = ct.user_id
    WHERE ct.amount > 0 AND ct.type IN ('admin_grant', 'game_win', 'referral_bonus')
    GROUP BY u.id, u.username
    ORDER BY "totalCoins" DESC
    LIMIT ${parsedLimit}
  `;
  const data = result.map(row => ({
    userId: row.userId,
    username: row.username,
    totalCoins: Number(row.totalCoins)
  }));
  res.json({ success: true, data });
};

export const getUserRegistrationStats = async (req: Request, res: Response) => {
  const { days = 30 } = req.query;
  const limit = parseInt(days as string);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - limit);

  const result = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  const data = result.map(row => ({ date: row.date, count: Number(row.count) }));
  res.json({ success: true, data });
};

export const getTierDistribution = async (req: Request, res: Response) => {
  const result = await prisma.user.groupBy({
    by: ['tierId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });
  const tiers = await prisma.tier.findMany();
  const distribution = result.map(r => ({
    tier: tiers.find(t => t.id === r.tierId)?.slug || 'unknown',
    count: r._count.id
  }));
  res.json({ success: true, data: distribution });
};