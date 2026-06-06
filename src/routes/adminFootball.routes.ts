import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import {
  getAllStars,
  createStar,
  updateStar,
  deleteStar,
  getAllMatches,
  updateMatch,
  deleteMatch,
  syncMatchesFromAPI,
} from '../controllers/adminFootball.controller.js';

const router = Router();
router.use(adminAuthMiddleware);

router.get('/stars', getAllStars);
router.post('/stars', createStar);
router.put('/stars/:id', updateStar);
router.delete('/stars/:id', deleteStar);

router.get('/matches', getAllMatches);
router.put('/matches/:id', updateMatch);
router.delete('/matches/:id', deleteMatch);
router.post('/matches/sync', syncMatchesFromAPI);

export default router;