import { Router } from 'express';
import {
  createCashPrize,
  createOfferForUser,
  seedDepositAddresses,
  seedCelebrities,
} from '../controllers/debug.controller.js';

const router = Router();
router.post('/create-cash-prize', createCashPrize);
router.post('/create-offer', createOfferForUser);
router.post('/seed-deposit-addresses', seedDepositAddresses);
router.post('/seed-celebrities', seedCelebrities);

export default router;