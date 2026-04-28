import cron from 'node-cron';
import { db } from '../config/firebase.js';
import { MPESA_CONFIG, generateAccessToken, generatePassword, getTimestamp } from '../config/mpesa.js';
import axios from 'axios';

const triggerMpesaSTK = async (phoneNumber, amount, accountName) => {
  const accessToken = await generateAccessToken();
  const timestamp = getTimestamp();
  const password = generatePassword(timestamp);
  const payload = {
    BusinessShortCode: MPESA_CONFIG.shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phoneNumber,
    PartyB: MPESA_CONFIG.shortCode,
    PhoneNumber: phoneNumber,
    CallBackURL: MPESA_CONFIG.callbackURL,
    AccountReference: `KPLC-${accountName.slice(0,10).replace(/\s+/g,'-').toUpperCase()}`,
    TransactionDesc: `Auto Payment - ${accountName}`
  };
  const response = await axios.post(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    payload,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
};

export const startScheduledPayments = () => {
  cron.schedule('45 11 * * *', async () => {
    console.log('🕐 Running scheduled payments check...');
    const today = new Date().toISOString().split('T')[0];
    try {
      // Check scheduled payments
      const schedSnap = await db.ref('scheduledPayments').orderByChild('scheduledDate').equalTo(today).once('value');
      const scheduled = schedSnap.val();
      if (scheduled) {
        for (const [id, payment] of Object.entries(scheduled)) {
          if (payment.scheduledDate === today) {
            try {
              await triggerMpesaSTK(payment.phoneNumber, payment.amount, payment.accountName);
              await db.ref(`scheduledPayments/${id}`).update({ status: 'triggered', triggeredAt: new Date().toISOString() });
              console.log(`✅ Scheduled payment triggered for ${payment.accountName}`);
            } catch (err) {
              await db.ref(`scheduledPayments/${id}`).update({ status: 'failed', failReason: err.message });
              console.log(`❌ Failed: ${err.message}`);
            }
          }
        }
      }
      // Check auto-pay
      const autoPaySnap = await db.ref('autoPaySettings').orderByChild('enabled').equalTo(true).once('value');
      const autoPaySettings = autoPaySnap.val();
      if (autoPaySettings) {
        for (const [userId, settings] of Object.entries(autoPaySettings)) {
          const accountsSnap = await db.ref('accounts').orderByChild('userId').equalTo(userId).once('value');
          const accounts = accountsSnap.val();
          if (accounts) {
            for (const [accountId, account] of Object.entries(accounts)) {
              if (account.dueDate === today && account.balance > 0) {
                try {
                  await triggerMpesaSTK(settings.phoneNumber, account.balance, account.name);
                  console.log(`✅ Auto-pay triggered for ${account.name}`);
                } catch (err) {
                  console.log(`❌ Auto-pay failed: ${err.message}`);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Scheduled payments error:', error);
    }
  });

// Cleanup job - mark pending payments older than 10 minutes as failed
cron.schedule('45 11 * * *', async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const snap = await db.ref('payments').orderByChild('status').equalTo('pending').once('value');
    const payments = snap.val();
    if (payments) {
      for (const [id, payment] of Object.entries(payments)) {
        if (payment.createdAt < tenMinutesAgo) {
          await db.ref(`payments/${id}`).update({
            status: 'failed',
            errorMessage: 'Payment timed out - no callback received',
            failedAt: new Date().toISOString()
          });
          console.log(`⏰ Payment ${id} marked as failed (timeout)`);
        }
      }
    }
  } catch (e) {
    console.error('Cleanup job error:', e.message);
  }
});

};
