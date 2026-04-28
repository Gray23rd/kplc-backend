// backend/routes/auth.js
import express from 'express';
import nodemailer from 'nodemailer';
import { 
  signup, 
  login, 
  verifyToken,
  getUserProfile,
  updateProfile
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { db, auth } from '../config/firebase.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-token', verifyToken);

// Protected routes (authentication required)
router.get('/profile', authenticate, getUserProfile);
router.put('/profile', authenticate, updateProfile);

export default router;
// Settings persistence routes
router.put('/profile/payment-methods', authenticate, async (req, res) => {
  try {
    const { paymentMethods } = req.body;
    await db.ref(`users/${req.user.uid}`).update({ paymentMethods, updatedAt: new Date().toISOString() });
    res.json({ message: 'Payment methods updated', paymentMethods });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/profile/notification-prefs', authenticate, async (req, res) => {
  try {
    const { notificationPrefs } = req.body;
    await db.ref(`users/${req.user.uid}`).update({ notificationPrefs, updatedAt: new Date().toISOString() });
    res.json({ message: 'Notification preferences updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/profile/budget-settings', authenticate, async (req, res) => {
  try {
    const { budgetSettings } = req.body;
    await db.ref(`users/${req.user.uid}`).update({ budgetSettings, updatedAt: new Date().toISOString() });
    res.json({ message: 'Budget settings updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/profile/security-settings', authenticate, async (req, res) => {
  try {
    const { securitySettings } = req.body;
    await db.ref(`users/${req.user.uid}`).update({ securitySettings, updatedAt: new Date().toISOString() });
    res.json({ message: 'Security settings updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/profile/language-settings', authenticate, async (req, res) => {
  try {
    const { languageSettings } = req.body;
    await db.ref(`users/${req.user.uid}`).update({ languageSettings, updatedAt: new Date().toISOString() });
    res.json({ message: 'Language settings updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/profile/autopay-settings', authenticate, async (req, res) => {
  try {
    const { autoPaySettings } = req.body;
    await db.ref(`users/${req.user.uid}`).update({ autoPaySettings, updatedAt: new Date().toISOString() });
    res.json({ message: 'Auto-pay settings saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI Chatbot proxy endpoint
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { messages, system } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system,
        messages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save notification
router.post('/notifications', authenticate, async (req, res) => {
  try {
    const { type, title, message } = req.body;
    const notifId = db.ref(`notifications/${req.user.uid}`).push().key;
    await db.ref(`notifications/${req.user.uid}/${notifId}`).set({
      id: notifId,
      type, title, message,
      time: 'Just now',
      read: false,
      createdAt: new Date().toISOString()
    });
    res.json({ message: 'Notification saved' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get notifications
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const snap = await db.ref(`notifications/${req.user.uid}`).orderByChild('createdAt').limitToLast(20).once('value');
    const data = snap.val();
    const notifications = data ? Object.values(data).reverse() : [];
    res.json({ notifications });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Mark notification as read
router.put('/notifications/:notifId/read', authenticate, async (req, res) => {
  try {
    await db.ref(`notifications/${req.user.uid}/${req.params.notifId}`).update({ read: true });
    res.json({ message: 'Marked as read' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Delete notification
router.delete('/notifications/:notifId', authenticate, async (req, res) => {
  try {
    await db.ref(`notifications/${req.user.uid}/${req.params.notifId}`).remove();
    res.json({ message: 'Deleted' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    // Check if user exists
    const userRecord = await auth.getUserByEmail(email).catch(() => null);
    if (!userRecord) return res.status(404).json({ error: 'No account found with this email address.' });
    // Send reset email via nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });
    await transporter.sendMail({
      from: `"UniPowerWallet" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Reset Your UniPowerWallet Password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
          <h2 style="color:#2563eb;">⚡ UniPowerWallet</h2>
          <h3>Password Reset Request</h3>
          <p>Hi ${userRecord.displayName || 'there'},</p>
          <p>We received a request to reset your password. Please contact our support team to complete the reset process.</p>
          <div style="background:#f0f9ff;padding:15px;border-radius:8px;margin:20px 0;">
            <p style="margin:0;">📧 <strong>support@unipowerwallet.co.ke</strong></p>
            <p style="margin:5px 0 0;">📞 <strong>+254 800 000 000</strong></p>
          </div>
          <p>If you did not request a password reset, please ignore this email.</p>
          <p style="color:#6b7280;font-size:12px;">UniPowerWallet Team</p>
        </div>
      `
    });
    res.json({ message: 'Password reset email sent successfully.' });
  } catch(e) {
    console.error('Forgot password error:', e);
    res.status(500).json({ error: 'Failed to send reset email.' });
  }
});
