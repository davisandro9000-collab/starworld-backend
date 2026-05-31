import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const PAGE_SIZE = 20;

export const getAuditLog = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const userId = req.query.userId as string | undefined;
  const action = req.query.action as string | undefined;

  const where: any = {};
  if (userId) where.targetUserId = userId;
  if (action && action !== 'all') where.action = action;

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        admin: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    success: true,
    entries: entries.map(e => ({
      id: e.id,
      admin: e.admin,
      action: e.action,
      targetUserId: e.targetUserId,
      metadata: e.metadata,
      createdAt: e.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
};