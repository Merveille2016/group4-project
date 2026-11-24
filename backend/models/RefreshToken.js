const mongoose = require('mongoose');

// Only the SHA-256 of each token is stored. A reused old token revokes its whole family.
const refreshTokenSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true },
  tokenVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, default: null },
  replacedByHash: { type: String, default: null },
  createdByIp: String,
  userAgent: String,
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
