import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware.js';
import {
  getAllCelebrities,
  getCelebrityById,
  createCelebrity,
  updateCelebrity,
  deleteCelebrity,
} from '../controllers/adminCelebrity.controller.js';

const router = Router();
router.use(adminAuthMiddleware);

router.get('/', getAllCelebrities);
router.get('/:id', getCelebrityById);
router.post('/', createCelebrity);
router.put('/:id', updateCelebrity);
router.delete('/:id', deleteCelebrity);

export default router;