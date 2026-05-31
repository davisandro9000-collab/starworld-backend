import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { v4 as uuidv4 } from 'uuid';

// Helper to get a single string from req.params.id
function getParamId(param: string | string[] | undefined): string {
  if (!param) throw new Error('Missing parameter');
  return Array.isArray(param) ? param[0] : param;
}

export const getAllCelebrities = async (req: Request, res: Response) => {
  const celebrities = await prisma.celebrity.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, celebrities });
};

export const getCelebrityById = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const celebrity = await prisma.celebrity.findUnique({ where: { id } });
  if (!celebrity) throw ApiError.notFound('Celebrity not found');
  res.json({ success: true, celebrity });
};

export const createCelebrity = async (req: Request, res: Response) => {
  const { name, slug, bio, imageUrl, isPublished } = req.body;
  if (!name || !slug) throw ApiError.badRequest('Name and slug are required');
  const existing = await prisma.celebrity.findUnique({ where: { slug } });
  if (existing) throw ApiError.badRequest('Slug already exists');
  const celebrity = await prisma.celebrity.create({
    data: {
      id: uuidv4(),
      name,
      slug,
      bio: bio || null,
      avatarUrl: imageUrl || null,
      isPublished: isPublished ?? true,
    },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'celebrity.create',
      targetUserId: null,
      metadata: { celebrityId: celebrity.id, name },
    },
  });
  res.status(201).json({ success: true, celebrity });
};

export const updateCelebrity = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const { name, slug, bio, imageUrl, isPublished } = req.body;
  const celebrity = await prisma.celebrity.update({
    where: { id },
    data: {
      name,
      slug,
      bio: bio || null,
      avatarUrl: imageUrl || null,
      isPublished: isPublished ?? true,
    },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'celebrity.update',
      metadata: { celebrityId: id, changes: req.body },
    },
  });
  res.json({ success: true, celebrity });
};

export const deleteCelebrity = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  await prisma.celebrity.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin.id,
      action: 'celebrity.delete',
      metadata: { celebrityId: id },
    },
  });
  res.json({ success: true });
};