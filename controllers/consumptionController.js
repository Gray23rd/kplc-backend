// backend/controllers/consumptionController.js
import { db } from '../config/firebase.js';
import { calculateBillBreakdown, getTariffInfo } from '../models/kplcTariff.js';
import { 
  calculateTotalConsumption,
  getApplianceBreakdown,
  calculateAppliancePercentages,
  DEFAULT_APPLIANCES
} from '../utils/consumptionCalc.js';

/**
 * Add appliances to an account
 * POST /api/consumption/appliances/:accountId
 */
export const addAppliances = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountId } = req.params;
    const { appliances } = req.body;

    if (!appliances || !Array.isArray(appliances)) {
      return res.status(400).json({ 
        error: 'Appliances array is required' 
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

    // Save appliances
    await db.ref(`appliances/${accountId}`).set(appliances);

    res.json({
      message: 'Appliances saved successfully',
      appliances,
      count: appliances.length
    });

  } catch (error) {
    console.error('Add appliances error:', error);
    res.status(500).json({ 
      error: 'Failed to save appliances' 
    });
  }
};

/**
 * Get appliances for an account
 * GET /api/consumption/appliances/:accountId
 */
export const getAppliances = async (req, res) => {
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

    // Get appliances
    const appliancesSnapshot = await db.ref(`appliances/${accountId}`).once('value');
    const appliances = appliancesSnapshot.val() || [];

    res.json({
      message: 'Appliances retrieved successfully',
      appliances,
      count: Array.isArray(appliances) ? appliances.length : 0
    });

  } catch (error) {
    console.error('Get appliances error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve appliances' 
    });
  }
};

/**
 * Calculate consumption and bill for an account
 * POST /api/consumption/calculate/:accountId
 */
export const calculateConsumption = async (req, res) => {
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

    // Get appliances
    const appliancesSnapshot = await db.ref(`appliances/${accountId}`).once('value');
    const appliances = appliancesSnapshot.val() || [];

    if (appliances.length === 0) {
      return res.status(400).json({ 
        error: 'No appliances configured for this account' 
      });
    }

    // Calculate total consumption
    const totalKwh = calculateTotalConsumption(appliances);

    // Get appliance breakdown
    let applianceBreakdown = getApplianceBreakdown(appliances);
    applianceBreakdown = calculateAppliancePercentages(applianceBreakdown);

    // Calculate bill breakdown
    const billBreakdown = calculateBillBreakdown(totalKwh, account.type);

    // Save consumption history
    const consumptionId = db.ref('consumptionHistory').push().key;
    const consumptionData = {
      id: consumptionId,
      accountId,
      userId,
      month: new Date().toISOString().slice(0, 7), // YYYY-MM
      totalKwh,
      billBreakdown,
      applianceBreakdown,
      createdAt: new Date().toISOString()
    };

    await db.ref(`consumptionHistory/${consumptionId}`).set(consumptionData);

    // Update account with latest consumption
    await db.ref(`accounts/${accountId}`).update({
      usage: totalKwh,
      balance: billBreakdown.total,
      updatedAt: new Date().toISOString()
    });

    res.json({
      message: 'Consumption calculated successfully',
      consumption: {
        totalKwh,
        billBreakdown,
        applianceBreakdown,
        topConsumers: applianceBreakdown
          .sort((a, b) => b.kwh - a.kwh)
          .slice(0, 5)
      }
    });

  } catch (error) {
    console.error('Calculate consumption error:', error);
    res.status(500).json({ 
      error: 'Failed to calculate consumption' 
    });
  }
};

/**
 * Get consumption history for an account
 * GET /api/consumption/history/:accountId
 */
export const getConsumptionHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountId } = req.params;
    const { limit = 12 } = req.query; // Default last 12 months

    // Verify account ownership
    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    if (!account || account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized access to this account' 
      });
    }

    // Get consumption history
    const historySnapshot = await db.ref('consumptionHistory')
      .orderByChild('accountId')
      .equalTo(accountId)
      .limitToLast(parseInt(limit))
      .once('value');

    const historyData = historySnapshot.val();
    const history = historyData ? Object.values(historyData) : [];

    // Sort by month descending
    history.sort((a, b) => b.month.localeCompare(a.month));

    res.json({
      message: 'Consumption history retrieved successfully',
      history,
      count: history.length
    });

  } catch (error) {
    console.error('Get consumption history error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve consumption history' 
    });
  }
};

/**
 * Get default appliance templates
 * GET /api/consumption/appliance-templates
 */
export const getApplianceTemplates = async (req, res) => {
  try {
    res.json({
      message: 'Appliance templates retrieved successfully',
      templates: DEFAULT_APPLIANCES
    });
  } catch (error) {
    console.error('Get appliance templates error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve appliance templates' 
    });
  }
};

/**
 * Get tariff information
 * GET /api/consumption/tariff
 */
export const getTariff = async (req, res) => {
  try {
    const { type = 'Residential' } = req.query;
    
    const tariffInfo = getTariffInfo(type);

    res.json({
      message: 'Tariff information retrieved successfully',
      tariff: tariffInfo
    });

  } catch (error) {
    console.error('Get tariff error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve tariff information' 
    });
  }
};
