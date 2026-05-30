// src/routes/celebrity.routes.ts
import { Router } from 'express';
import { 
  getCelebrityBySlug, 
  getAllCelebrities,
  getCelebrityNews,
  getCelebrityEvents
} from '../controllers/celebrity.controller.js';

const router = Router();

router.get('/', getAllCelebrities);
router.get('/:slug', getCelebrityBySlug);
router.get('/:slug/news', getCelebrityNews);
router.get('/:slug/events', getCelebrityEvents);

export default router;