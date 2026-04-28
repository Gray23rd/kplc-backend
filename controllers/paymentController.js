// backend/controllers/paymentController.js
import { db } from '../config/firebase.js';
import { 
  MPESA_CONFIG, 
  generateAccessToken, 
  generatePassword, 
  getTimestamp 
} from '../config/mpesa.js';
import axios from 'axios';

/**
 * Initiate M-Pesa STK Push payment
 * POST /api/payments/mpesa/initiate
 */
export const initiateMpesaPayment = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountId, amount, phoneNumber } = req.body;

    // Validation
    if (!accountId || !amount || !phoneNumber) {
      return res.status(400).json({ 
        error: 'Account ID, amount, and phone number are required' 
      });
    }

    // Verify account ownership
    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    if (!account || account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized access to this account' 
      });
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = phoneNumber.replace(/[\s+]/g, '');
    
    // Validate Kenyan phone number
    if (!formattedPhone.match(/^254\d{9}$/)) {
      return res.status(400).json({ 
        error: 'Invalid phone number. Use format: 254712345678' 
      });
    }

    // Generate M-Pesa access token
    const accessToken = await generateAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);

    // Create payment reference
    const paymentId = db.ref('payments').push().key;
    const paymentRef = `UPW${paymentId.slice(-8).toUpperCase()}`;

    // STK Push request payload
    const stkPushPayload = {
      BusinessShortCode: MPESA_CONFIG.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: MPESA_CONFIG.shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: MPESA_CONFIG.callbackURL,
      AccountReference: `KPLC-${account.name.slice(0,10).replace(/\s+/g,'-').toUpperCase()}`,
      TransactionDesc: `KPLC Bill - ${account.name}`
    };

    // Make STK Push request
    const response = await axios.post(
      MPESA_CONFIG.stkPushURL,
      stkPushPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Save payment record
    const paymentData = {
      id: paymentId,
      userId,
      accountId,
      accountName: account.name,
      amount: Math.round(amount),
      phoneNumber: formattedPhone,
      reference: paymentRef,
      merchantRequestID: response.data.MerchantRequestID,
      checkoutRequestID: response.data.CheckoutRequestID,
      status: 'pending',
      method: 'M-Pesa',
      createdAt: new Date().toISOString()
    };

    await db.ref(`payments/${paymentId}`).set(paymentData);

    res.json({
      message: 'Payment initiated successfully. Check your phone for M-Pesa prompt.',
      payment: {
        id: paymentId,
        reference: paymentRef,
        amount: Math.round(amount),
        status: 'pending',
        merchantRequestID: response.data.MerchantRequestID,
        checkoutRequestID: response.data.CheckoutRequestID
      }
    });

  } catch (error) {
    console.error('M-Pesa initiate error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to initiate M-Pesa payment',
      details: error.response?.data?.errorMessage || error.message 
    });
  }
};

/**
 * M-Pesa Callback Handler
 * POST /api/payments/mpesa/callback
 */
export const mpesaCallback = async (req, res) => {
  try {
    const callbackData = req.body;

    console.log('M-Pesa Callback received:', JSON.stringify(callbackData, null, 2));

    const resultCode = callbackData.Body?.stkCallback?.ResultCode;
    const checkoutRequestID = callbackData.Body?.stkCallback?.CheckoutRequestID;

    if (!checkoutRequestID) {
      return res.status(400).json({ error: 'Invalid callback data' });
    }

    // Find payment by CheckoutRequestID
    const paymentsSnapshot = await db.ref('payments')
      .orderByChild('checkoutRequestID')
      .equalTo(checkoutRequestID)
      .once('value');

    const paymentsData = paymentsSnapshot.val();
    
    if (!paymentsData) {
      console.error('Payment not found for CheckoutRequestID:', checkoutRequestID);
      return res.status(404).json({ error: 'Payment not found' });
    }

    const paymentId = Object.keys(paymentsData)[0];
    const payment = paymentsData[paymentId];

    // Update payment status based on result code
    if (resultCode === 0) {
      // Success
      const callbackMetadata = callbackData.Body.stkCallback.CallbackMetadata.Item;
      const mpesaReceiptNumber = callbackMetadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = callbackMetadata.find(item => item.Name === 'TransactionDate')?.Value;

      await db.ref(`payments/${paymentId}`).update({
        status: 'completed',
        mpesaReceiptNumber,
        transactionDate: transactionDate?.toString(),
        completedAt: new Date().toISOString(),
        callbackData
      });

      // Update account balance
      const account = await db.ref(`accounts/${payment.accountId}`).once('value');
      const currentBalance = account.val()?.balance || 0;
      const newBalance = Math.max(0, currentBalance - payment.amount);

      await db.ref(`accounts/${payment.accountId}`).update({
        balance: newBalance,
        status: newBalance === 0 ? 'paid' : 'pending',
        updatedAt: new Date().toISOString()
      });

    } else {
      // Failed
      const errorMessage = callbackData.Body.stkCallback.ResultDesc;
      
      await db.ref(`payments/${paymentId}`).update({
        status: 'failed',
        errorMessage,
        failedAt: new Date().toISOString(),
        callbackData
      });
    }

    res.json({ message: 'Callback processed successfully' });

  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.status(500).json({ 
      error: 'Failed to process callback',
      details: error.message 
    });
  }
};

/**
 * Query M-Pesa transaction status
 * GET /api/payments/mpesa/status/:paymentId
 */
export const queryMpesaStatus = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { paymentId } = req.params;

    // Get payment
    const paymentSnapshot = await db.ref(`payments/${paymentId}`).once('value');
    const payment = paymentSnapshot.val();

    if (!payment) {
      return res.status(404).json({ 
        error: 'Payment not found' 
      });
    }

    if (payment.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized access to this payment' 
      });
    }

    res.json({
      message: 'Payment status retrieved successfully',
      payment: {
        id: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        accountName: payment.accountName,
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt
      }
    });

  } catch (error) {
    console.error('Query status error:', error);
    res.status(500).json({ 
      error: 'Failed to query payment status' 
    });
  }
};

/**
 * Get payment history for user
 * GET /api/payments/history
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 20, accountId } = req.query;

    let query = db.ref('payments')
      .orderByChild('userId')
      .equalTo(userId)
      .limitToLast(parseInt(limit));

    const paymentsSnapshot = await query.once('value');
    const paymentsData = paymentsSnapshot.val();
    
    let payments = paymentsData ? Object.values(paymentsData) : [];

    // Filter by accountId if provided
    if (accountId) {
      payments = payments.filter(p => p.accountId === accountId);
    }

    // Sort by date descending
    payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      message: 'Payment history retrieved successfully',
      payments,
      count: payments.length
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve payment history' 
    });
  }
};
