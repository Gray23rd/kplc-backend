// backend/routes/predictions.js
import express from 'express';
import { getPrediction } from '../controllers/predictionController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get prediction for an account
router.get('/:accountId', authenticate, getPrediction);

export default router;
