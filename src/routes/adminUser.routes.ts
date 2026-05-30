// src/routes/adminUser.routes.ts
import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import {
  getUsers,
  getUserById,
  grantCoinsToUser,
  setUserTier,
  banUser,
  unbanUser
} from '../controllers/adminUser.controller.js';

const router = Router();

// All admin user routes require admin authentication
router.use(adminAuthMiddleware);

router.get('/', getUsers);
router.get('/:userId', getUserById);
router.post('/:userId/grant-coins', grantCoinsToUser);
router.put('/:userId/tier', setUserTier);
router.post('/:userId/ban', banUser);
router.post('/:userId/unban', unbanUser);

export default router;