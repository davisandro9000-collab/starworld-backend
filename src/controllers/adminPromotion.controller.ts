import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { v4 as uuidv4 } from 'uuid';

function getParamId(param: string | string[] | undefined): string {
  if (!param) throw new Error('Missing parameter');
  return Array.isArray(param) ? param[0] : param;
}

export const getAllPromotions = async (req: Request, res: Response) => {
  const promotions = await prisma.promotion.findMany({
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
  });
  res.json({ success: true, promotions });
};

export const getPromotionById = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const promotion = await prisma.promotion.findUnique({ where: { id } });
  if (!promotion) throw ApiError.notFound('Promotion not found');
  res.json({ success: true, promotion });
};

export const createPromotion = async (req: Request, res: Response) => {
  const { type, title, description, imageUrl, accentColor, ctaText, ctaLink, sortOrder, isActive } = req.body;
  if (!type || !title) throw ApiError.badRequest('Type and title are required');
  const promotion = await prisma.promotion.create({
    data: {
      id: uuidv4(),
      type,
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      accentColor: accentColor || null,
      ctaText: ctaText || null,
      ctaLink: ctaLink || null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'promotion.create',
      metadata: { promotionId: promotion.id, type },
    },
  });
  res.status(201).json({ success: true, promotion });
};

export const updatePromotion = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const { type, title, description, imageUrl, accentColor, ctaText, ctaLink, sortOrder, isActive } = req.body;
  const promotion = await prisma.promotion.update({
    where: { id },
    data: {
      type,
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      accentColor: accentColor || null,
      ctaText: ctaText || null,
      ctaLink: ctaLink || null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'promotion.update',
      metadata: { promotionId: id, changes: req.body },
    },
  });
  res.json({ success: true, promotion });
};

export const deletePromotion = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  await prisma.promotion.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'promotion.delete',
      metadata: { promotionId: id },
    },
  });
  res.json({ success: true });
};