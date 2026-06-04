import { Router } from 'express';
import { getAllPromotions } from '../controllers/promotion.controller.js';

const router = Router();
router.get('/', getAllPromotions);
export default router;