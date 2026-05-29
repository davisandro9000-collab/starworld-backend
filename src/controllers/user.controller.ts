// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { TierService } from '../services/tier.service.js';

const tierService = new TierService(prisma);

export const getTierInfo = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const tierInfo = await tierService.getUserTierInfo(userId);
  
  res.json({
    success: true,
    ...tierInfo
  });
};