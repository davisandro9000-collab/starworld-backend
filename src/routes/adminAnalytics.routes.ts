// src/routes/adminAnalytics.routes.ts
import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import {
  getDailyActiveUsers,
  getTotalCoinsIssued,
  getDepositVolume,
  getGameWinRates,
  getTopPerformers,
  getUserRegistrationStats,
  getTierDistribution
} from '../controllers/adminAnalytics.controller.js';

const router = Router();
router.use(adminAuthMiddleware);

router.get('/daily-active-users', getDailyActiveUsers);
router.get('/total-coins-issued', getTotalCoinsIssued);
router.get('/deposit-volume', getDepositVolume);
router.get('/game-win-rates', getGameWinRates);
router.get('/top-performers', getTopPerformers);
router.get('/user-registration-stats', getUserRegistrationStats);
router.get('/tier-distribution', getTierDistribution);

export default router;