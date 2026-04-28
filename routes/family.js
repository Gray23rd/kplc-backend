// backend/routes/family.js
import express from 'express';
import {
  inviteFamilyMember,
  acceptInvitation,
  getFamilyMembers,
  removeFamilyMember,
  updateMemberRole,
  getMyInvitations
} from '../controllers/familyController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.post('/invite', authenticate, inviteFamilyMember);
router.post('/accept-invitation/:invitationId', authenticate, acceptInvitation);
router.get('/members/:accountId', authenticate, getFamilyMembers);
router.delete('/members/:memberId', authenticate, removeFamilyMember);
router.put('/members/:memberId/role', authenticate, updateMemberRole);
router.get('/invitations', authenticate, getMyInvitations);

export default router;
