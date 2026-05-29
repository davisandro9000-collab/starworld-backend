import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { idempotencyMiddleware } from '../middleware/idempotency.middleware.js';
import {
  createDeposit,
  getDepositAddresses,
  getDepositHistory
} from '../controllers/deposit.controller.js';

const router = Router();

// All deposit routes require authentication
router.use(authMiddleware);

router.get('/addresses', getDepositAddresses);
router.get('/history', getDepositHistory);
router.post('/', idempotencyMiddleware, createDeposit);

export default router;
