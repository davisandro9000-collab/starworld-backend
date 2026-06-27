import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import { adminLogin, adminGetMe } from '../controllers/adminAuth.controller.js';

const router = Router();

// Public routes
router.post('/login', adminLogin);
router.get('/ping', (req, res) => {   // <-- ADD THIS
  res.json({ success: true, message: 'adminAuth routes are loaded' });
});

// Protected routes
router.get('/me', adminAuthMiddleware, adminGetMe);
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

export default router;