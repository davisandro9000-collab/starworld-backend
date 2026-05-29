// src/routes/adminAuth.routes.ts
import { Router } from 'express';
import { adminLogin, adminGetMe } from '../controllers/adminAuth.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';

const router = Router();

// Public admin route
router.post('/login', adminLogin);

// Protected admin route
router.get('/me', adminAuthMiddleware, adminGetMe);

export default router;