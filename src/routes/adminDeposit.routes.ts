// src/routes/adminDeposit.routes.ts
import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import { idempotencyMiddleware } from '../middleware/idempotency.middleware.js';
import {
  getPendingDeposits,
  getPendingCount,
  creditDeposit,
  rejectDeposit,
  getDepositHistory
} from '../controllers/adminDeposit.controller.js';

const router = Router();

// All admin deposit routes require admin authentication
router.use(adminAuthMiddleware);

router.get('/pending', getPendingDeposits);
router.get('/pending-count', getPendingCount);
router.get('/history', getDepositHistory);
router.post('/:depositId/credit', idempotencyMiddleware, creditDeposit);
router.post('/:depositId/reject', idempotencyMiddleware, rejectDeposit);

export default router;