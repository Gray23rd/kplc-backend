// backend/config/mpesa.js
// M-Pesa Daraja API Configuration

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// M-Pesa API Configuration
export const MPESA_CONFIG = {
  // Sandbox URLs (use production URLs in production)
  authURL: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
  stkPushURL: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
  queryURL: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
  
  // Credentials from .env
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  passkey: process.env.MPESA_PASSKEY || '',
  shortCode: process.env.MPESA_SHORTCODE || '174379', // Sandbox shortcode
  
  // Callback URL (your server URL)
  callbackURL: process.env.MPESA_CALLBACK_URL || 'http://localhost:5000/api/payments/mpesa/callback'
};

/**
 * Generate M-Pesa Access Token
 */
export const generateAccessToken = async () => {
  try {
    const auth = Buffer.from(
      `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
    ).toString('base64');

    const response = await axios.get(MPESA_CONFIG.authURL, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('M-Pesa auth error:', error.response?.data || error.message);
    throw new Error('Failed to generate M-Pesa access token');
  }
};

/**
 * Generate M-Pesa Password
 */
export const generatePassword = (timestamp) => {
  const password = Buffer.from(
    `${MPESA_CONFIG.shortCode}${MPESA_CONFIG.passkey}${timestamp}`
  ).toString('base64');
  
  return password;
};

/**
 * Get current timestamp in M-Pesa format
 */
export const getTimestamp = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};
