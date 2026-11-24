const config = require('../config');
const { issueRefreshToken } = require('./refreshTokens');

// What the frontend gets back and what the session remembers about the person
function toAccount(admin) {
  return {
    id: String(admin._id),
    name: admin.name || null,
    email: admin.email,
    role: admin.role,
    tokenVersion: admin.tokenVersion,
  };
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

// A fresh session ID on every login stops session fixation
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
}

// Session cookie + refresh cookie. `family` keeps a refreshed login in the same chain.
async function establishLogin(req, res, admin, { family } = {}) {
  await startSession(req, admin);
  const { token } = await issueRefreshToken(admin, { family, ...requestMeta(req) });
  setRefreshCookie(res, token);
}

module.exports = {
  toAccount,
  requestMeta,
  startSession,
  endSession,
  setRefreshCookie,
  clearAuthCookies,
  establishLogin,
};
