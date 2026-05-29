import { Router } from 'express';
import { getCelebrityBySlug, getAllCelebrities } from '../controllers/celebrity.controller.js';

const router = Router();

router.get('/', getAllCelebrities);
router.get('/:slug', getCelebrityBySlug);

export default router;