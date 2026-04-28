// backend/routes/payments.js
import express from 'express';
import { db } from '../config/firebase.js';
import {
  initiateMpesaPayment,
  mpesaCallback,
  queryMpesaStatus,
  getPaymentHistory
} from '../controllers/paymentController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// M-Pesa payment routes
router.post('/mpesa/initiate', authenticate, initiateMpesaPayment);
router.post('/mpesa/callback', mpesaCallback); // No auth - called by M-Pesa
router.get('/mpesa/status/:paymentId', authenticate, queryMpesaStatus);
router.get('/history', authenticate, getPaymentHistory);

export default router;

// Schedule a payment
router.post('/schedule', authenticate, async (req, res) => {
  try {
    const { accountId, amount, phoneNumber, scheduledDate, accountName } = req.body;
    if (!accountId || !amount || !phoneNumber || !scheduledDate) {
      return res.status(400).json({ error: 'accountId, amount, phoneNumber and scheduledDate are required' });
    }
    const id = db.ref('scheduledPayments').push().key;
    const payment = {
      id, accountId, amount, phoneNumber, scheduledDate,
      accountName: accountName || 'KPLC Account',
      userId: req.user.uid,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    await db.ref(`scheduledPayments/${id}`).set(payment);
    res.json({ message: 'Payment scheduled successfully', payment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save auto-pay settings
router.post('/autopay/settings', authenticate, async (req, res) => {
  try {
    const { phoneNumber, enabled } = req.body;
    await db.ref(`autoPaySettings/${req.user.uid}`).set({
      phoneNumber, enabled,
      updatedAt: new Date().toISOString()
    });
    res.json({ message: 'Auto-pay settings saved!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Test trigger - manually run scheduled payments now (for testing only)
router.post('/schedule/trigger-now', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const schedSnap = await db.ref('scheduledPayments').orderByChild('status').equalTo('active').once('value');
    const scheduled = schedSnap.val();
    if (!scheduled) return res.json({ message: 'No scheduled payments found for today' });
    const results = [];
    for (const [id, payment] of Object.entries(scheduled)) {
      if (payment.scheduledDate === today) {
        try {
          // Import and trigger real M-Pesa STK push
          const { generateAccessToken, generatePassword, getTimestamp, MPESA_CONFIG } = await import('../config/mpesa.js');
          const axios = (await import('axios')).default;
          const accessToken = await generateAccessToken();
          const timestamp = getTimestamp();
          const password = generatePassword(timestamp);
          const stkPayload = {
            BusinessShortCode: MPESA_CONFIG.shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(Number(payment.amount)),
            PartyA: payment.phoneNumber,
            PartyB: MPESA_CONFIG.shortCode,
            PhoneNumber: payment.phoneNumber,
            CallBackURL: MPESA_CONFIG.callbackURL,
            AccountReference: `KPLC-${payment.accountName.slice(0,10).replace(/\s+/g,'-').toUpperCase()}`,
            TransactionDesc: `Scheduled Payment - ${payment.accountName}`
          };
          const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            stkPayload,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          // Log trigger but keep active for future payments
          const logId = db.ref('paymentLogs').push().key;
          await db.ref(`paymentLogs/${logId}`).set({
            scheduledPaymentId: id,
            accountName: payment.accountName,
            amount: payment.amount,
            triggeredAt: new Date().toISOString(),
            status: 'triggered'
          });
          results.push({ id, accountName: payment.accountName, amount: payment.amount, status: 'triggered', mpesa: response.data });
        } catch (err) {
          await db.ref(`scheduledPayments/${id}`).update({ status: 'failed', failReason: err.message });
          results.push({ id, accountName: payment.accountName, status: 'failed', error: err.message });
        }
      }
    }
    res.json({ message: `Processed ${results.length} payment(s)`, payments: results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a payment from history
router.delete('/history/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.uid;
    const snap = await db.ref(`payments/${paymentId}`).once('value');
    const payment = snap.val();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });
    await db.ref(`payments/${paymentId}`).remove();
    res.json({ message: 'Payment deleted successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a payment from history
router.delete('/history/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.uid;
    const snap = await db.ref(`payments/${paymentId}`).once('value');
    const payment = snap.val();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });
    await db.ref(`payments/${paymentId}`).remove();
    res.json({ message: 'Payment deleted successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
