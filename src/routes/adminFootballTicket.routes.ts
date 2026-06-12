import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import { createTicketListing, getListings, cancelListing } from '../controllers/adminFootballTicket.controller.js';

const router = Router();
router.use(adminAuthMiddleware);
router.post('/listings', createTicketListing);
router.get('/listings', getListings);
router.delete('/listings/:id', cancelListing);

export default router;