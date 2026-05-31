import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import { getAuditLog } from '../controllers/adminAudit.controller.js';

const router = Router();
router.use(adminAuthMiddleware);

router.get('/', getAuditLog);

export default router;