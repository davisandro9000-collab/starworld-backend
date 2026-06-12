import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getListingsForMatch, buyListing } from '../controllers/footballTicketResale.controller.js';

const router = Router();
router.get('/match/:matchId', getListingsForMatch);
router.use(authMiddleware);
router.post('/buy', buyListing);

export default router;