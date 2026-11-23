const mongoose = require('mongoose');

// Single-use password reset tokens. Only the SHA-256 of the token is stored;
// the raw token exists only in the emailed link.
const passwordResetTokenSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  requestedIp: String,
}, { timestamps: true });

// MongoDB deletes the document once it expires
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
