// src/routes/adminAuth.routes.ts
import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import { adminLogin, adminGetMe } from '../controllers/adminAuth.controller.js';

const router = Router();

// Public routes (no authentication required)
router.post('/login', adminLogin);

// Protected routes (require admin token)
router.get('/me', adminAuthMiddleware, adminGetMe);

// Optional logout (client-side)
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

export default router;