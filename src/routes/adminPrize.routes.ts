import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import {
  getPendingPrizes,
  getAllPrizes,
  createPrize,
  updatePrize,
  deletePrize,
  markPrizeDelivered,
  markPrizeFailed,
} from '../controllers/adminPrize.controller.js';

const router = Router();
router.use(adminAuthMiddleware);

router.get('/pending', getPendingPrizes);
router.get('/', getAllPrizes);
router.post('/', createPrize);
router.put('/:id', updatePrize);
router.delete('/:id', deletePrize);
router.post('/:id/deliver', markPrizeDelivered);
router.post('/:id/fail', markPrizeFailed);

export default router;