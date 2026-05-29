// src/routes/referral.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import { idempotencyMiddleware } from '../middleware/idempotency.middleware.js';
import {
  getReferralStats,
  claimPayout,
  getPendingPayouts,
  processPayout
} from '../controllers/referral.controller.js';

const router = Router();

// User routes
router.get('/my-stats', authMiddleware, getReferralStats);
router.post('/claim-payout', authMiddleware, idempotencyMiddleware, claimPayout);

// Admin routes
router.get('/pending-payouts', adminAuthMiddleware, getPendingPayouts);
router.post('/process-payout/:userId', adminAuthMiddleware, idempotencyMiddleware, processPayout);

export default router;