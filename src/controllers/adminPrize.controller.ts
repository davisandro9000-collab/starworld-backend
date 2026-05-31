import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { v4 as uuidv4 } from 'uuid';

function getParamId(param: string | string[] | undefined): string {
  if (!param) throw new Error('Missing parameter');
  return Array.isArray(param) ? param[0] : param;
}

export const getPendingPrizes = async (req: Request, res: Response) => {
  const redemptions = await prisma.prizeRedemption.findMany({
    where: { status: 'pending' },
    include: { user: { select: { id: true, username: true, email: true } }, prize: true },
    orderBy: { createdAt: 'asc' },
  });
  const prizes = redemptions.map(r => ({
    id: r.id,
    userId: r.userId,
    username: r.user.username,
    prizeLabel: r.prize.label,
    prizeType: r.prize.type,
    code: r.code,
    createdAt: r.createdAt,
  }));
  res.json(prizes);
};

export const getAllPrizes = async (req: Request, res: Response) => {
  const prizes = await prisma.prize.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ success: true, prizes });
};

export const createPrize = async (req: Request, res: Response) => {
  const { label, type, coinValue, tierSlug, isActive } = req.body;
  const prize = await prisma.prize.create({
    data: {
      id: uuidv4(),
      label,
      type,
      coinValue: coinValue || null,
      tierSlug: tierSlug || null,
      isActive: isActive ?? true,
    },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'prize.create',
      metadata: { prizeId: prize.id, label },
    },
  });
  res.status(201).json({ success: true, prize });
};

export const updatePrize = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const { label, type, coinValue, tierSlug, isActive } = req.body;
  const prize = await prisma.prize.update({
    where: { id },
    data: { label, type, coinValue, tierSlug, isActive },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'prize.update',
      metadata: { prizeId: id, changes: req.body },
    },
  });
  res.json({ success: true, prize });
};

export const deletePrize = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  await prisma.prize.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'prize.delete',
      metadata: { prizeId: id },
    },
  });
  res.json({ success: true });
};

export const markPrizeDelivered = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const redemption = await prisma.prizeRedemption.update({
    where: { id },
    data: { status: 'fulfilled', fulfilledBy: req.admin.id, fulfilledAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'prize.delivered',
      metadata: { redemptionId: id, userId: redemption.userId },
    },
  });
  res.json({ success: true });
};

export const markPrizeFailed = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const { reason } = req.body;
  const redemption = await prisma.prizeRedemption.update({
    where: { id },
    data: { status: 'voided', fulfilledBy: req.admin.id, fulfilledAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'prize.failed',
      metadata: { redemptionId: id, userId: redemption.userId, reason },
    },
  });
  res.json({ success: true });
};