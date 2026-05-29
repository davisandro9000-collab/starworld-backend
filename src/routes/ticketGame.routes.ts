// src/routes/ticketGame.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { idempotencyMiddleware } from '../middleware/idempotency.middleware.js';
import {
  enterMatchmaking,
  startGame,
  recordTap,
  getResult,
} from '../controllers/ticketGame.controller.js';

const router = Router();
router.use(authMiddleware);

router.post('/enter', idempotencyMiddleware, enterMatchmaking);
router.post('/:sessionId/start', startGame);
router.post('/:sessionId/tap', idempotencyMiddleware, recordTap);
router.get('/:sessionId/result', getResult);

export default router;