const mongoose = require('mongoose');

// One document per refresh token ever issued. Only the SHA-256 of the token is stored,
// so a database leak doesn't hand out working tokens.
//
// Tokens rotate: each refresh revokes the presented token and issues a new one in the
// same `family`. If a revoked token is presented again, someone kept a copy, so the
// whole family is revoked.
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

// MongoDB deletes the document once it expires
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
