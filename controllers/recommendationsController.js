// backend/controllers/recommendationsController.js
import { db } from '../config/firebase.js';
import { generateRecommendations, getSeasonalRecommendations } from '../utils/recommendations.js';

/**
 * Get energy-saving recommendations for an account
 * GET /api/recommendations/:accountId
 */
export const getRecommendations = async (req, res) => {
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

    // Get latest consumption data
    const historySnapshot = await db.ref('consumptionHistory')
      .orderByChild('accountId')
      .equalTo(accountId)
      .limitToLast(1)
      .once('value');

    const historyData = historySnapshot.val();
    
    if (!historyData) {
      return res.status(400).json({ 
        error: 'No consumption data available. Please calculate consumption first.' 
      });
    }

    const latestConsumption = Object.values(historyData)[0];

    // Generate recommendations
    const recommendations = generateRecommendations(latestConsumption);

    // Get seasonal tips
    const currentMonth = new Date().getMonth() + 1;
    const seasonalTips = getSeasonalRecommendations(currentMonth);

    // Save recommendations
    const recId = db.ref('recommendations').push().key;
    const recData = {
      id: recId,
      accountId,
      userId,
      ...recommendations,
      seasonalTips,
      createdAt: new Date().toISOString()
    };

    await db.ref(`recommendations/${recId}`).set(recData);

    res.json({
      message: 'Recommendations generated successfully',
      ...recommendations,
      seasonalTips,
      accountName: account.name
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: error.message 
    });
  }
};

/**
 * Get recommendation history
 * GET /api/recommendations/history/:accountId
 */
export const getRecommendationHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountId } = req.params;
    const { limit = 5 } = req.query;

    // Verify account ownership
    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    if (!account || account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized access to this account' 
      });
    }

    // Get recommendation history
    const recSnapshot = await db.ref('recommendations')
      .orderByChild('accountId')
      .equalTo(accountId)
      .limitToLast(parseInt(limit))
      .once('value');

    const recData = recSnapshot.val();
    const history = recData ? Object.values(recData) : [];

    // Sort by date descending
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      message: 'Recommendation history retrieved successfully',
      history,
      count: history.length
    });

  } catch (error) {
    console.error('Get recommendation history error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve recommendation history' 
    });
  }
};
