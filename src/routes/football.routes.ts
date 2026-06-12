import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getAllTeams, getTeamBySlug, getTeamPlayers, getTeamMatches } from '../controllers/footballTeam.controller.js';
import {
  getMatches,
  getMatchById,
  getUserPredictions,
  submitPrediction,
  getLeaderboard,
  getActivePredictionGames,
  submitPredictionEntry,
  getUserPredictionEntries,
  getPredictionLeaderboard,
} from '../controllers/football.controller.js';
import { getNewsForTeam } from '../controllers/footballNews.controller.js';

const router = Router();

// Specific routes (order matters!)
router.get('/teams', getAllTeams);
router.get('/teams/:slug/news', getNewsForTeam);
router.get('/teams/:slug/matches', getTeamMatches);
router.get('/teams/:slug/players', getTeamPlayers);
router.get('/teams/:slug', getTeamBySlug);

router.get('/matches', getMatches);
router.get('/matches/:id', getMatchById);

// Prediction routes (legacy)
router.get('/predictions', authMiddleware, getUserPredictions);
router.post('/predictions', authMiddleware, submitPrediction);
router.get('/leaderboard', getLeaderboard);

// Advanced prediction games
router.get('/predictions/games', getActivePredictionGames);
router.post('/predictions/entries', authMiddleware, submitPredictionEntry);
router.get('/predictions/my-entries', authMiddleware, getUserPredictionEntries);
router.get('/predictions/leaderboard', getPredictionLeaderboard);

export default router;