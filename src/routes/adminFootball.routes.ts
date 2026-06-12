import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import {
  getAllTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  getAllMatches,
  createMatch,
  updateMatch,
  deleteMatch,
  syncMatchesFromAPI,
} from '../controllers/adminFootballTeam.controller.js';
import { getPlayers, updatePlayerStats } from '../controllers/adminFootballPlayer.controller.js';

const router = Router();
router.use(adminAuthMiddleware);

// Teams
router.get('/teams', getAllTeams);
router.post('/teams', createTeam);
router.put('/teams/:id', updateTeam);
router.delete('/teams/:id', deleteTeam);

// Players (only from player controller)
router.get('/players', getPlayers);
router.patch('/players/:id/stats', updatePlayerStats);

// Matches
router.get('/matches', getAllMatches);
router.post('/matches', createMatch);
router.put('/matches/:id', updateMatch);
router.delete('/matches/:id', deleteMatch);
router.post('/matches/sync', syncMatchesFromAPI);

export default router;