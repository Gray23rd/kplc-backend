// backend/controllers/accountController.js
import { db } from '../config/firebase.js';
import { validateKPLCAccount } from '../utils/validation.js';

/**
 * Add/Link KPLC Account
 * POST /api/accounts/add
 */
export const addAccount = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { 
      accountNumber, 
      meterNumber, 
      name, 
      type, 
      address 
    } = req.body;

    // Validation
    if (!accountNumber || !meterNumber || !name) {
      return res.status(400).json({ 
        error: 'Account number, meter number, and name are required' 
      });
    }

    if (!validateKPLCAccount(accountNumber)) {
      return res.status(400).json({ 
        error: 'Invalid KPLC account number format' 
      });
    }

    // Check if account already exists for this user
    const existingAccountsSnapshot = await db
      .ref(`accounts`)
      .orderByChild('userId')
      .equalTo(userId)
      .once('value');

    const existingAccounts = existingAccountsSnapshot.val() || {};
    
    // Check if this account number is already linked
    const isDuplicate = Object.values(existingAccounts).some(
      acc => acc.accountNumber === accountNumber
    );

    if (isDuplicate) {
      return res.status(400).json({ 
        error: 'This account is already linked to your profile' 
      });
    }

    // Create new account
    const accountId = db.ref('accounts').push().key;
    const accountData = {
      id: accountId,
      userId,
      accountNumber,
      meterNumber,
      name,
      type: type || 'Residential',
      address: address || '',
      balance: 0,
      usage: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.ref(`accounts/${accountId}`).set(accountData);

    res.status(201).json({
      message: 'KPLC account linked successfully',
      account: accountData
    });

  } catch (error) {
    console.error('Add account error:', error);
    res.status(500).json({ 
      error: 'Failed to add account',
      details: error.message 
    });
  }
};

/**
 * Get All User Accounts
 * GET /api/accounts
 */
export const getUserAccounts = async (req, res) => {
  try {
    const userId = req.user.uid;

    // Get own accounts
    const accountsSnapshot = await db.ref('accounts').orderByChild('userId').equalTo(userId).once('value');
    const accountsData = accountsSnapshot.val();
    const ownAccounts = accountsData ? Object.values(accountsData) : [];

    // Get shared accounts from accepted invitations
    const userSnapshot = await db.ref(`users/${userId}`).once('value');
    const userEmail = userSnapshot.val()?.email || '';

    const invSnapshot = await db.ref('familyInvitations').orderByChild('status').equalTo('accepted').once('value');
    const invData = invSnapshot.val();
    const sharedAccountIds = new Set();

    if (invData) {
      for (const inv of Object.values(invData)) {
        if (inv.email === userEmail || inv.acceptedBy === userId) {
          if (inv.accountIds) inv.accountIds.forEach(id => sharedAccountIds.add(id));
        }
      }
    }

    // Fetch shared accounts
    const sharedAccounts = [];
    for (const accountId of sharedAccountIds) {
      const accSnapshot = await db.ref(`accounts/${accountId}`).once('value');
      const acc = accSnapshot.val();
      if (acc && acc.userId !== userId) {
        sharedAccounts.push({ ...acc, isShared: true, sharedRole: 'Member' });
      }
    }

    const accounts = [...ownAccounts, ...sharedAccounts];

    res.json({
      message: accounts.length === 0 ? 'No accounts found' : 'Accounts retrieved successfully',
      accounts,
      count: accounts.length
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to retrieve accounts' });
  }
};

/**
 * Get Single Account by ID
 * GET /api/accounts/:accountId
 */
export const getAccountById = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountId } = req.params;

    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found' 
      });
    }

    // Verify ownership
    if (account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized access to this account' 
      });
    }

    res.json({
      message: 'Account retrieved successfully',
      account
    });

  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve account' 
    });
  }
};

/**
 * Update Account Details
 * PUT /api/accounts/:accountId
 */
export const updateAccount = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountId } = req.params;
    const { name, type, address } = req.body;

    // Get existing account
    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found' 
      });
    }

    // Verify ownership
    if (account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized access to this account' 
      });
    }

    // Prepare updates
    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (name) updates.name = name;
    if (type) updates.type = type;
    if (address !== undefined) updates.address = address;

    await db.ref(`accounts/${accountId}`).update(updates);

    res.json({
      message: 'Account updated successfully',
      updates
    });

  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ 
      error: 'Failed to update account' 
    });
  }
};

/**
 * Delete Account
 * DELETE /api/accounts/:accountId
 */
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountId } = req.params;

    // Get existing account
    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found' 
      });
    }

    // Verify ownership
    if (account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized access to this account' 
      });
    }

    // Delete account
    await db.ref(`accounts/${accountId}`).remove();

    res.json({
      message: 'Account deleted successfully',
      accountId
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      error: 'Failed to delete account' 
    });
  }
};