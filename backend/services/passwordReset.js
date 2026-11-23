const PasswordResetToken = require('../models/PasswordResetToken');
const config = require('../config');
const { randomToken, sha256 } = require('./tokenUtils');

// Creates a reset token and returns the raw value for the emailed link.
// Any earlier unused link for this account stops working.
async function createResetToken(admin, { ip } = {}) {
  await PasswordResetToken.deleteMany({ admin: admin._id, usedAt: null });

  const token = randomToken();
  await PasswordResetToken.create({
    admin: admin._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + config.passwordReset.minutes * 60 * 1000),
    requestedIp: ip,
  });
  return token;
}

// Marks the token used and returns its record, or null if it's unknown, used or expired.
// Done in one atomic update so the same link can't be used twice in parallel.
async function consumeResetToken(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const now = new Date();
  return PasswordResetToken.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );
}

function buildResetLink(token) {
  return `${config.appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}

module.exports = { createResetToken, consumeResetToken, buildResetLink };
