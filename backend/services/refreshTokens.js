const crypto = require('crypto');
const Admin = require('../models/Admin');
const RefreshToken = require('../models/RefreshToken');
const config = require('../config');
const { randomToken, sha256 } = require('./tokenUtils');

class RefreshError extends Error {
  // code: missing | invalid | expired | revoked | reused | raced | stale
  constructor(code, message = 'Please log in again.') {
    super(message);
    this.code = code;
  }
}

async function issueRefreshToken(admin, { family, ip, userAgent } = {}) {
  const token = randomToken();
  const doc = await RefreshToken.create({
    admin: admin._id,
    tokenHash: sha256(token),
    family: family || crypto.randomUUID(),
    tokenVersion: admin.tokenVersion,
    expiresAt: new Date(Date.now() + config.refreshToken.days * 24 * 60 * 60 * 1000),
    createdByIp: ip,
    userAgent: userAgent ? String(userAgent).slice(0, 300) : undefined,
  });
  return { token, doc };
}

function revokeFamily(family, reason) {
  return RefreshToken.updateMany(
    { family, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } },
  );
}

function revokeAllForAdmin(adminId, reason) {
  return RefreshToken.updateMany(
    { admin: adminId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } },
  );
}

// Ends the chain this token belongs to (one device). Returns the token's record, or null.
async function revokeByToken(token, reason) {
  if (typeof token !== 'string' || !token) return null;
  const doc = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (doc) await revokeFamily(doc.family, reason);
  return doc;
}

// Swaps a valid refresh token for a new one. Returns { token, admin }, or throws RefreshError.
async function rotateRefreshToken(token, { ip, userAgent } = {}) {
  if (typeof token !== 'string' || !token) throw new RefreshError('missing');

  const tokenHash = sha256(token);
  const now = new Date();

  // Claim the token atomically: if two requests race, only one gets past this
  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, revokeReason: 'rotated' } },
  );

  if (!current) {
    const existing = await RefreshToken.findOne({ tokenHash });
    if (!existing) throw new RefreshError('invalid');
    if (existing.expiresAt <= now) throw new RefreshError('expired');
    if (existing.revokeReason !== 'rotated') throw new RefreshError('revoked');

    const ageMs = now - existing.revokedAt;
    if (ageMs < config.refreshToken.reuseGraceSeconds * 1000) {
      // Most likely two tabs refreshing at the same moment; the other one won
      throw new RefreshError('raced');
    }

    // An already rotated token came back: someone kept a copy. Kill the whole chain.
    await revokeFamily(existing.family, 'reuse-detected');
    throw new RefreshError('reused');
  }

  const admin = await Admin.findById(current.admin);
  if (!admin || admin.tokenVersion !== current.tokenVersion) {
    // Account deleted, or logged in/out/reset elsewhere since this token was issued
    await revokeFamily(current.family, 'stale');
    throw new RefreshError('stale');
  }

  const next = await issueRefreshToken(admin, { family: current.family, ip, userAgent });
  await RefreshToken.updateOne({ _id: current._id }, { $set: { replacedByHash: next.doc.tokenHash } });

  return { token: next.token, admin };
}

module.exports = {
  RefreshError,
  issueRefreshToken,
  rotateRefreshToken,
  revokeByToken,
  revokeFamily,
  revokeAllForAdmin,
};
