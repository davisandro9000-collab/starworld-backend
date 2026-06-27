// src/routes/adminTournament.routes.ts
import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import { advanceTournament } from '../controllers/adminTournament.controller.js';

const router = Router();
router.use(adminAuthMiddleware);
router.post('/advance', advanceTournament);

export default router;