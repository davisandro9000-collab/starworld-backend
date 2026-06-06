import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getFootballStars,
  getFootballStarBySlug,
  getFootballStarNews,
  getMatches,
  getMatchById,
  getUserPredictions,
  submitPrediction,
  getLeaderboard,
} from '../controllers/football.controller.js';

const router = Router();

router.get('/stars', getFootballStars);
router.get('/stars/:slug', getFootballStarBySlug);
router.get('/stars/:slug/news', getFootballStarNews);
router.get('/matches', getMatches);
router.get('/matches/:id', getMatchById);
router.get('/predictions', authMiddleware, getUserPredictions);
router.post('/predictions', authMiddleware, submitPrediction);
router.get('/leaderboard', getLeaderboard);

export default router;