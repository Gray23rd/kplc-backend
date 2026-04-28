// backend/controllers/predictionController.js
import { db } from '../config/firebase.js';
import fetch from 'node-fetch';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
/**
 * Get prediction for next month's bill
 * GET /api/predictions/:accountId
 */
export const getPrediction = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountId } = req.params;

    // Verify account ownership
    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    if (!account || account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized access to this account' 
      });
    }

    // Get consumption history (last 3 months)
    const historySnapshot = await db.ref('consumptionHistory')
      .orderByChild('accountId')
      .equalTo(accountId)
      .limitToLast(3)
      .once('value');

    const historyData = historySnapshot.val();
    const history = historyData ? Object.values(historyData) : [];

    if (history.length < 1) {
      return res.status(400).json({ 
        error: 'Not enough historical data. Need at least 1 month of data.' 
      });
    }

    // Sort by date
    history.sort((a, b) => b.month.localeCompare(a.month));

    // Get appliances
    const appliancesSnapshot = await db.ref(`appliances/${accountId}`).once('value');
    const appliances = appliancesSnapshot.val() || [];

    // Prepare features for ML model
    const currentMonth = new Date().getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const isHotSeason = [1, 2, 3, 9, 10, 11, 12].includes(nextMonth) ? 1 : 0;
    const daysInNextMonth = new Date(2026, nextMonth, 0).getDate();

    const features = {
      prev_month_kwh: history[0]?.totalKwh || 0,
      prev_2_months_kwh: history[1]?.totalKwh || history[0]?.totalKwh || 0,
      prev_3_months_kwh: history[2]?.totalKwh || history[0]?.totalKwh || 0,
      num_appliances: appliances.length,
      has_ac: appliances.some(a => a.name.toLowerCase().includes('air') || a.name.toLowerCase().includes('ac')) ? 1 : 0,
      has_water_heater: appliances.some(a => a.name.toLowerCase().includes('water') && a.name.toLowerCase().includes('heater')) ? 1 : 0,
      month: nextMonth,
      is_hot_season: isHotSeason,
      days_in_month: daysInNextMonth,
      account_type: account.type === 'Commercial' ? 1 : 0
    };

    // Call ML service
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features)
    });

    const prediction = await mlResponse.json();

    if (!prediction.success) {
      throw new Error(prediction.error || 'Prediction failed');
    }

    // Save prediction
    const predictionId = db.ref('predictions').push().key;
    const predictionData = {
      id: predictionId,
      accountId,
      userId,
      ...prediction.prediction,
      createdAt: new Date().toISOString()
    };

    await db.ref(`predictions/${predictionId}`).set(predictionData);

    res.json({
      message: 'Prediction generated successfully',
      prediction: prediction.prediction,
      model_info: prediction.model_info
    });

  } catch (error) {
    console.error('Get prediction error:', error);
    res.status(500).json({ 
      error: 'Failed to generate prediction',
      details: error.message 
    });
  }
};
