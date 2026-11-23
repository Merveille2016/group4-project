const Admin = require('../models/Admin');
const config = require('../config');
const { issueRefreshToken, revokeAllForAdmin } = require('./refreshTokens');

function toAccount(admin) {
  return {
    id: String(admin._id),
    name: admin.name || null,
    email: admin.email,
    role: admin.role,
    tokenVersion: admin.tokenVersion,
    twoFactorEnabled: Boolean(admin.twoFactorEnabled),
  };
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

// New session ID on every login to stop session fixation
function startSession(req, admin) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.admin = toAccount(admin);
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

function endSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: config.refreshToken.cookiePath,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(config.refreshToken.cookieName, token, {
    ...refreshCookieOptions(),
    maxAge: config.refreshToken.days * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(config.refreshToken.cookieName, refreshCookieOptions());
  res.clearCookie(config.session.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });
  res.clearCookie(config.preAuth.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: config.preAuth.cookiePath,
  });
}

async function establishLogin(req, res, admin, { family } = {}) {
  await startSession(req, admin);
  const { token } = await issueRefreshToken(admin, { family, ...requestMeta(req) });
  setRefreshCookie(res, token);
}

// Final step of every login: ends older sessions and hands out new cookies
async function completeLogin(req, res, adminId, extra = {}) {
  const updated = await Admin.findByIdAndUpdate(
    adminId,
    {
      $set: { failedLoginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date(), ...extra },
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: 'after' },
  );
  await revokeAllForAdmin(adminId, 'new-login');
  await establishLogin(req, res, updated);
  return updated;
}

module.exports = {
  toAccount,
  requestMeta,
  startSession,
  endSession,
  setRefreshCookie,
  clearAuthCookies,
  establishLogin,
  completeLogin,
};
