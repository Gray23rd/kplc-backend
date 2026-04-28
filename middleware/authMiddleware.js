// backend/middleware/authMiddleware.js
import { auth, db } from '../config/firebase.js';

/**
 * Authentication middleware - SIMPLIFIED FOR TESTING
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No token provided. Authorization header must be: Bearer <token>' 
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // TEMPORARY: For testing, we'll decode the custom token to get the UID
    // In production, the client should exchange custom token for ID token
    try {
      // Try to verify as ID token first
      const decodedToken = await auth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email
      };
    } catch (idTokenError) {
      
      const base64Payload = token.split('.')[1];
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
      
      
      const userSnapshot = await db.ref(`users/${payload.uid}`).once('value');
      const user = userSnapshot.val();
      
      if (!user) {
        return res.status(401).json({ 
          error: 'User not found' 
        });
      }

      req.user = {
        uid: payload.uid,
        email: user.email
      };
    }

    next();

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
};