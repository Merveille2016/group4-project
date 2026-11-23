const express = require('express');
const Admin = require('../models/Admin');
const PasswordResetToken = require('../models/PasswordResetToken');
const RefreshToken = require('../models/RefreshToken');
const config = require('../config');
const { protect } = require('../middleware/authMiddleware');
const { createRateLimiters } = require('../middleware/rateLimiters');
const { hashPassword, verifyPassword, spendVerifyTime } = require('../services/password');
const { normalizeEmail, validatePassword, validateName } = require('../services/validation');
const { lockRemainingMs, recordFailedLogin } = require('../services/lockout');
const { RefreshError, rotateRefreshToken, revokeByToken, revokeAllForAdmin } = require('../services/refreshTokens');
const { createResetToken, consumeResetToken, buildResetLink } = require('../services/passwordReset');
const {
  toAccount, requestMeta, startSession, endSession, setRefreshCookie, clearAuthCookies, establishLogin,
} = require('../services/session');

const INVALID_LOGIN = 'Invalid email or password';
const BAD_RESET_LINK = 'This reset link is invalid or has expired. Please request a new one.';

function sendLocked(res, remainingMs) {
  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.ceil(seconds / 60);
  res.set('Retry-After', String(seconds));
  return res.status(429).json({
    message: `Account locked after too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
  });
}

function createAuthRouter({ mailer, rateLimits = config.rateLimits }) {
  const router = express.Router();
  const limit = createRateLimiters(rateLimits);

  router.post('/register', limit.register, async (req, res) => {
    const { name, email, password } = req.body || {};

    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ message: nameError });

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ message: 'A valid email is required' });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    if (await Admin.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    try {
      const admin = await Admin.create({
        name: name.trim(),
        email: normalizedEmail,
        password: await hashPassword(password),
      });
      return res.status(201).json({ message: 'Account created. Please log in.', admin: toAccount(admin) });
    } catch (err) {
      // Two sign ups with the same email at once
      if (err.code === 11000) return res.status(409).json({ message: 'An account with this email already exists' });
      throw err;
    }
  });

  router.post('/login', limit.login, async (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email: normalizedEmail }).select('+password');
    if (!admin) {
      await spendVerifyTime(password);
      return res.status(400).json({ message: INVALID_LOGIN });
    }

    const lockedFor = lockRemainingMs(admin);
    if (lockedFor > 0) return sendLocked(res, lockedFor);

    const { ok, needsRehash } = await verifyPassword(admin.password, password);
    if (!ok) {
      const result = await recordFailedLogin(admin._id);
      if (result.locked) return sendLocked(res, result.lockoutUntil - Date.now());
      return res.status(400).json({ message: INVALID_LOGIN });
    }

    const update = {
      $set: { failedLoginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date() },
      $inc: { tokenVersion: 1 },
    };
    // Upgrade old hashes now that we have the plain password
    if (needsRehash) update.$set.password = await hashPassword(password);

    const updated = await Admin.findByIdAndUpdate(admin._id, update, { returnDocument: 'after' });
    await revokeAllForAdmin(admin._id, 'new-login');
    await establishLogin(req, res, updated);

    return res.json({ message: 'Login successful', admin: toAccount(updated) });
  });

  router.post('/refresh', limit.refresh, async (req, res) => {
    try {
      const { token, admin } = await rotateRefreshToken(req.cookies?.[config.refreshToken.cookieName], requestMeta(req));
      await startSession(req, admin);
      setRefreshCookie(res, token);
      return res.json({ message: 'Session refreshed', admin: toAccount(admin) });
    } catch (err) {
      if (!(err instanceof RefreshError)) throw err;
      // On a race the browser already has the winner's cookie
      if (err.code !== 'raced') clearAuthCookies(res);
      return res.status(401).json({ message: err.message });
    }
  });

  router.get('/me', protect, async (req, res) => {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(401).json({ message: 'This account no longer exists' });
    return res.json({ admin: toAccount(admin) });
  });

  router.post('/logout', async (req, res) => {
    const refreshDoc = await revokeByToken(req.cookies?.[config.refreshToken.cookieName], 'logout');
    const adminId = req.session?.admin?.id || refreshDoc?.admin;

    if (adminId) {
      await Admin.updateOne({ _id: adminId }, { $inc: { tokenVersion: 1 } });
      await revokeAllForAdmin(adminId, 'logout');
    }

    await endSession(req);
    clearAuthCookies(res);
    return res.json({ message: 'Logged out successfully' });
  });

  router.post('/forgot-password', limit.forgotPasswordByIp, limit.forgotPasswordByEmail, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'A valid email is required' });

    const admin = await Admin.findOne({ email });
    if (admin) {
      const token = await createResetToken(admin, requestMeta(req));
      // Not awaited so known emails don't answer slower than unknown ones
      mailer
        .sendPasswordReset({
          to: admin.email,
          name: admin.name,
          link: buildResetLink(token),
          minutes: config.passwordReset.minutes,
        })
        .catch((err) => console.error('[forgot-password] could not send reset email:', err.message));
    }

    return res.json({ message: 'If an account exists for that email, a password reset link has been sent.' });
  });

  router.post('/reset-password', limit.resetPassword, async (req, res) => {
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || !token) return res.status(400).json({ message: BAD_RESET_LINK });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const record = await consumeResetToken(token);
    if (!record) return res.status(400).json({ message: BAD_RESET_LINK });

    const admin = await Admin.findByIdAndUpdate(
      record.admin,
      {
        $set: {
          password: await hashPassword(password),
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!admin) return res.status(400).json({ message: BAD_RESET_LINK });

    await revokeAllForAdmin(admin._id, 'password-reset');
    await PasswordResetToken.deleteMany({ admin: admin._id, usedAt: null });

    return res.json({ message: 'Your password has been reset. Please log in with your new password.' });
  });

  router.delete('/me', protect, async (req, res) => {
    const { password } = req.body || {};
    if (typeof password !== 'string' || !password) return res.status(400).json({ message: 'Password is required' });

    const admin = await Admin.findById(req.user.id).select('+password');
    if (!admin) return res.status(401).json({ message: 'This account no longer exists' });

    const { ok } = await verifyPassword(admin.password, password);
    if (!ok) return res.status(400).json({ message: 'Incorrect password' });

    await Promise.all([
      admin.deleteOne(),
      RefreshToken.deleteMany({ admin: admin._id }),
      PasswordResetToken.deleteMany({ admin: admin._id }),
    ]);
    await endSession(req);
    clearAuthCookies(res);
    return res.json({ message: 'Account deleted' });
  });

  return router;
}

module.exports = { createAuthRouter };
