// src/routes/game.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { idempotencyMiddleware } from '../middleware/idempotency.middleware.js';
import {
  startGame,
  completeGame,
  getGameHistory,
  getLeaderboard
} from '../controllers/game.controller.js';

const router = Router();

// All game routes require authentication
router.use(authMiddleware);

router.post('/session/start', startGame);
router.post('/session/:sessionId/complete', idempotencyMiddleware, completeGame);
router.get('/history', getGameHistory);
router.get('/leaderboard', getLeaderboard);

export default router;