import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getActiveGames,
  submitPredictionEntry,
  getUserPredictionEntries,
  getPredictionLeaderboard,
} from '../controllers/footballPrediction.controller.js';

const router = Router();

router.get('/games', getActiveGames);
router.get('/leaderboard', getPredictionLeaderboard);
router.use(authMiddleware);
router.post('/entries', submitPredictionEntry);
router.get('/my-entries', getUserPredictionEntries);

export default router;