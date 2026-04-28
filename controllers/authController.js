// backend/controllers/authController.js
import { auth, db } from '../config/firebase.js';
import { validateEmail, validatePassword } from '../utils/validation.js';

/**
 * User Signup
 * POST /api/auth/signup
 */
export const signup = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'Email, password, and name are required' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone || null
    });

    // Create user profile in Realtime Database
    const userProfile = {
      uid: userRecord.uid,
      email,
      name,
      phone: phone || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.ref(`users/${userRecord.uid}`).set(userProfile);

    // Generate custom token for auto-login
    const customToken = await auth.createCustomToken(userRecord.uid);

    // Auto-accept any pending invitations for this email
    try {
      const invitationsSnapshot = await db.ref('familyInvitations')
        .orderByChild('email')
        .equalTo(email)
        .once('value');
      
      const invitations = invitationsSnapshot.val();
      if (invitations) {
        for (const [invId, inv] of Object.entries(invitations)) {
          if (inv.status === 'pending' && new Date(inv.expiresAt) > new Date()) {
            // Add as family member
            const memberId = db.ref('familyMembers').push().key;
            const memberData = {
              id: memberId,
              invitationId: invId,
              userId: userRecord.uid,
              email,
              name,
              role: inv.role,
              accountIds: inv.accountIds,
              joinedAt: new Date().toISOString()
            };
            await db.ref(`familyMembers/${memberId}`).set(memberData);
            // Update invitation status
            await db.ref(`familyInvitations/${invId}`).update({
              status: 'accepted',
              acceptedAt: new Date().toISOString(),
              acceptedBy: userRecord.uid
            });
            console.log(`✅ Auto-accepted invitation ${invId} for ${email} as ${inv.role}`);
          }
        }
      }
    } catch (invErr) {
      console.log('⚠️ Auto-accept invitation error (non-critical):', invErr.message);
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        uid: userRecord.uid,
        email,
        name,
        phone: phone || ''
      },
      token: customToken
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ 
        error: 'Email already in use' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to create user',
      details: error.message 
    });
  }
};

/**
 * User Login
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Get user by email
    const userRecord = await auth.getUserByEmail(email);

    // Generate custom token
    const customToken = await auth.createCustomToken(userRecord.uid);

    // Get user profile from database
    const userSnapshot = await db.ref(`users/${userRecord.uid}`).once('value');
    const userProfile = userSnapshot.val();

    res.json({
      message: 'Login successful',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userProfile?.name || userRecord.displayName,
        phone: userProfile?.phone || ''
      },
      token: customToken
    });

  } catch (error) {
    console.error('Login error:', error);

    if (error.code === 'auth/user-not-found') {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    res.status(500).json({ 
      error: 'Login failed',
      details: error.message 
    });
  }
};

/**
 * Verify Token
 * POST /api/auth/verify-token
 */
export const verifyToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        error: 'Token is required' 
      });
    }

    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);
    
    // Get user profile
    const userSnapshot = await db.ref(`users/${decodedToken.uid}`).once('value');
    const userProfile = userSnapshot.val();

    res.json({
      valid: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: userProfile?.name || '',
        phone: userProfile?.phone || ''
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ 
      valid: false,
      error: 'Invalid or expired token' 
    });
  }
};

/**
 * Get User Profile
 * GET /api/auth/profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    const userSnapshot = await db.ref(`users/${userId}`).once('value');
    const userProfile = userSnapshot.val();

    if (!userProfile) {
      return res.status(404).json({ 
        error: 'User profile not found' 
      });
    }

    res.json({
      user: userProfile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Failed to get user profile' 
    });
  }
};

/**
 * Update User Profile
 * PUT /api/auth/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name, phone, address, city, country } = req.body;

    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (country !== undefined) updates.country = country;

    await db.ref(`users/${userId}`).update(updates);

    // Also update Firebase Auth profile
    if (name) {
      await auth.updateUser(userId, {
        displayName: name
      });
    }

    res.json({
      message: 'Profile updated successfully',
      user: updates
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Failed to update profile' 
    });
  }
};