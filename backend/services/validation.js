const config = require('../config');
const Admin = require('../models/Admin');

// Rejecting non strings also stops query injection like { "$ne": "" }
function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  return Admin.EMAIL_PATTERN.test(email) ? email : null;
}

// Length only, following NIST SP 800-63B
function validatePassword(value) {
  const { minLength, maxLength } = config.password;
  if (typeof value !== 'string' || value.length === 0) return 'Password is required';
  if (value.length < minLength) return `Password must be at least ${minLength} characters`;
  if (value.length > maxLength) return `Password must be at most ${maxLength} characters`;
  return null;
}

function validateName(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Name is required';
  if (value.trim().length > 100) return 'Name must be at most 100 characters';
  return null;
}

module.exports = { normalizeEmail, validatePassword, validateName };
