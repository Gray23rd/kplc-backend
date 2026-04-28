// backend/routes/recommendations.js
import express from 'express';
import {
  getRecommendations,
  getRecommendationHistory
} from '../controllers/recommendationsController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.get('/:accountId', authenticate, getRecommendations);
router.get('/history/:accountId', authenticate, getRecommendationHistory);

export default router;
