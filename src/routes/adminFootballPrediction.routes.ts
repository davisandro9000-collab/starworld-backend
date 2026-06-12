import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import {
  createPredictionGame,
  updatePredictionGame,
  deletePredictionGame,
  resolveGame,
} from '../controllers/adminFootballPrediction.controller.js';

const router = Router();
router.use(adminAuthMiddleware);
router.post('/games', createPredictionGame);
router.put('/games/:id', updatePredictionGame);
router.delete('/games/:id', deletePredictionGame);
router.post('/games/:id/resolve', resolveGame);

export default router;