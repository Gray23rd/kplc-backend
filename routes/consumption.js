// backend/routes/consumption.js
import express from 'express';
import {
  addAppliances,
  getAppliances,
  calculateConsumption,
  getConsumptionHistory,
  getApplianceTemplates,
  getTariff
} from '../controllers/consumptionController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no auth needed)
router.get('/appliance-templates', getApplianceTemplates);
router.get('/tariff', getTariff);

// Protected routes (authentication required)
router.post('/appliances/:accountId', authenticate, addAppliances);
router.get('/appliances/:accountId', authenticate, getAppliances);
router.post('/calculate/:accountId', authenticate, calculateConsumption);
router.get('/history/:accountId', authenticate, getConsumptionHistory);

export default router;
