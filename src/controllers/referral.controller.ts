// src/controllers/referral.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { ReferralService } from '../services/referral.service.js';

const idempotencyService = new IdempotencyService();
const referralService = new ReferralService(prisma, idempotencyService);

export const getReferralStats = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const stats = await referralService.getReferralStats(userId);
  res.json({ success: true, ...stats });
};

export const claimPayout = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }
  const result = await referralService.claimPayout(userId, idempotencyKey);
  res.json({ success: true, ...result });
};

export const getPendingPayouts = async (req: Request, res: Response) => {
  // Admin only
  const payouts = await referralService.getPendingPayouts();
  res.json({ success: true, payouts });
};

export const processPayout = async (req: Request, res: Response) => {
  // Ensure userId is a string, not string[]
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const adminId = req.admin!.id;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }
  const result = await referralService.processPayout(userId, adminId, idempotencyKey);
  res.json({ success: true, ...result });
};