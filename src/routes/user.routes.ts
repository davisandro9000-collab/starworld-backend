// src/routes/user.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getTierInfo } from '../controllers/user.controller.js';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

router.get('/tier', getTierInfo);

export default router;