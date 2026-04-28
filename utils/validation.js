// backend/utils/validation.js

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
export const validatePassword = (password) => {
  // At least 6 characters
  return password && password.length >= 6;
};

/**
 * Validate phone number (Kenyan format)
 */
export const validatePhone = (phone) => {
  // Kenyan phone: +254XXXXXXXXX or 07XXXXXXXX or 01XXXXXXXX
  const phoneRegex = /^(\+254|0)[17]\d{8}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate KPLC account number
 */
export const validateKPLCAccount = (accountNumber) => {
  // KPLC account numbers are typically 11-13 digits
  const accountRegex = /^\d{11,13}$/;
  return accountRegex.test(accountNumber);
};

/**
 * Sanitize user input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};