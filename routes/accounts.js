// backend/routes/accounts.js
import express from 'express';
import { 
  addAccount,
  getUserAccounts,
  getAccountById,
  updateAccount,
  deleteAccount
} from '../controllers/accountController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Test route WITHOUT authentication - MUST come BEFORE router.use(authenticate)
router.post('/test-add', async (req, res) => {
  try {
    const { accountNumber, meterNumber, name } = req.body;
    res.json({
      message: 'Test successful - routes are working!',
      data: { accountNumber, meterNumber, name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected routes - authentication required for everything below
router.post('/add', authenticate, addAccount);
router.get('/', authenticate, getUserAccounts);
router.get('/:accountId', authenticate, getAccountById);
router.put('/:accountId', authenticate, updateAccount);
router.delete('/:accountId', authenticate, deleteAccount);

export default router;