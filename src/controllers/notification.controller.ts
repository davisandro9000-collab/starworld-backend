import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { NotificationService } from '../services/notification.service.js';

const notificationService = new NotificationService(prisma);

export const getNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const result = await notificationService.getUserNotifications(userId, page, limit);
  res.json({ success: true, ...result });
};

export const markAsRead = async (req: Request, res: Response) => {
  const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.id;
  await notificationService.markAsRead(notificationId, userId);
  res.json({ success: true });
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await notificationService.markAllAsRead(userId);
  res.json({ success: true });
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const count = await prisma.userNotification.count({
    where: { userId, isRead: false },
  });
  res.json({ success: true, count });
};