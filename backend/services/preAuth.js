const PreAuthToken = require('../models/PreAuthToken');
const config = require('../config');
const { randomToken, sha256 } = require('./tokenUtils');

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: config.preAuth.cookiePath,
  };
}

async function startPreAuth(res, admin) {
  await PreAuthToken.deleteMany({ admin: admin._id });
  const token = randomToken();
  await PreAuthToken.create({
    admin: admin._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + config.preAuth.minutes * 60 * 1000),
  });
  res.cookie(config.preAuth.cookieName, token, { ...cookieOptions(), maxAge: config.preAuth.minutes * 60 * 1000 });
}

function findPreAuth(req) {
  const token = req.cookies?.[config.preAuth.cookieName];
  if (typeof token !== 'string' || !token) return null;
  return PreAuthToken.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
}

// Counts a wrong code. Returns false once the token has used up its attempts.
async function recordPreAuthFailure(doc) {
  const updated = await PreAuthToken.findByIdAndUpdate(doc._id, { $inc: { attempts: 1 } }, { returnDocument: 'after' });
  if (!updated || updated.attempts >= config.preAuth.maxAttempts) {
    await PreAuthToken.deleteOne({ _id: doc._id });
    return false;
  }
  return true;
}

async function endPreAuth(res, doc) {
  if (doc) await PreAuthToken.deleteOne({ _id: doc._id });
  res.clearCookie(config.preAuth.cookieName, cookieOptions());
}

module.exports = { startPreAuth, findPreAuth, recordPreAuthFailure, endPreAuth };
