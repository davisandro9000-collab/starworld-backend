// src/routes/adminTicket.routes.ts
import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import {
  getFlaggedListings,
  removeFlaggedListing,
  resolveExpiredAuctions,
  forceResolveAuction,              // <-- import the new function
} from '../controllers/adminTicket.controller.js';

const router = Router();
router.use(adminAuthMiddleware);

router.get('/flagged', getFlaggedListings);
router.post('/:id/remove', removeFlaggedListing);
router.post('/resolve-expired', resolveExpiredAuctions);
router.post('/force-resolve/:id', forceResolveAuction);   // <-- new route

export default router;