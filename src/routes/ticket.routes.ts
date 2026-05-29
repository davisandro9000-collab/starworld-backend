// src/routes/ticket.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { idempotencyMiddleware } from '../middleware/idempotency.middleware.js';
import {
  getEvents,
  getListings,
  getListing,
  createListing,
  buyFixedPrice,
  placeBid,
  cancelListing,
  getMyListings,
  getMyPurchases
} from '../controllers/ticket.controller.js';

const router = Router();

// Public routes (or authenticated for viewing)
router.get('/events', authMiddleware, getEvents);
router.get('/exchange', authMiddleware, getListings);
router.get('/exchange/:id', authMiddleware, getListing);

// Protected routes
router.post('/exchange', authMiddleware, idempotencyMiddleware, createListing);
router.post('/exchange/:id/buy', authMiddleware, idempotencyMiddleware, buyFixedPrice);
router.post('/exchange/:id/bid', authMiddleware, idempotencyMiddleware, placeBid);
router.delete('/exchange/:id', authMiddleware, cancelListing);
router.get('/my-listings', authMiddleware, getMyListings);
router.get('/my-purchases', authMiddleware, getMyPurchases);

export default router;