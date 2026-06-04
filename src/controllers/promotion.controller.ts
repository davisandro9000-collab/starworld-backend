import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const getAllPromotions = async (req: Request, res: Response) => {
  const promotions = await prisma.promotion.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
  });
  res.json({ success: true, promotions });
};