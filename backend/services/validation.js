const config = require('../config');
const Admin = require('../models/Admin');

// Returns the trimmed, lowercased email, or null if it isn't a usable email.
// Rejecting non-strings here also stops query injection like { "email": { "$ne": "" } }.
function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  return Admin.EMAIL_PATTERN.test(email) ? email : null;
}

// Returns an error message, or null if the password is acceptable.
// Length only, no "must contain a symbol" rules, following NIST SP 800-63B.
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
