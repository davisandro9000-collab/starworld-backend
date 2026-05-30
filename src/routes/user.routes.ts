// src/routes/user.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getCurrentUser,
  getUserBalance,
  updateProfile,
  getTierInfo,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/user.controller.js';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

router.get('/me', getCurrentUser);
router.get('/balance', getUserBalance);
router.patch('/profile', updateProfile);
router.get('/tier', getTierInfo);
router.get('/notifications', getNotifications);
router.patch('/notifications/:notificationId/read', markNotificationRead);
router.patch('/notifications/read-all', markAllNotificationsRead);

export default router;