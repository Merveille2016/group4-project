const express = require('express');
const Admin = require('../models/Admin');
const PreAuthToken = require('../models/PreAuthToken');
const config = require('../config');
const { protect } = require('../middleware/authMiddleware');
const { createRateLimiters } = require('../middleware/rateLimiters');
const { verifyPassword } = require('../services/password');
const { lockRemainingMs, recordFailedLogin, sendLocked } = require('../services/lockout');
const { revokeAllForAdmin } = require('../services/refreshTokens');
const { findPreAuth, recordPreAuthFailure, endPreAuth } = require('../services/preAuth');
const { toAccount, establishLogin, completeLogin } = require('../services/session');
const {
  encryptSecret, decryptSecret, generateSecret, enrolmentDetails, matchTotp, acceptTotp,
  generateBackupCodes, consumeBackupCode, backupCodesLeft,
} = require('../services/twoFactor');

const WRONG_CODE = 'That code is not right. Please try again.';
const SIGN_IN_AGAIN = 'Your sign in timed out. Please enter your password again.';

function createTwoFactorRouter({ rateLimits = config.rateLimits } = {}) {
  const router = express.Router();
  const limit = createRateLimiters(rateLimits);

  router.get('/status', protect, async (req, res) => {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(401).json({ message: 'This account no longer exists' });
    return res.json({
      enabled: admin.twoFactorEnabled,
      backupCodesLeft: admin.twoFactorEnabled ? await backupCodesLeft(admin._id) : 0,
    });
  });

  router.post('/setup', protect, limit.twoFactorManage, async (req, res) => {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(401).json({ message: 'This account no longer exists' });
    if (admin.twoFactorEnabled) return res.status(400).json({ message: 'Two factor authentication is already on.' });

    const secret = generateSecret();
    await Admin.updateOne({ _id: admin._id }, { $set: { twoFactorPendingSecret: encryptSecret(secret) } });
    return res.json(await enrolmentDetails(secret, admin.email));
  });

  router.post('/enable', protect, limit.twoFactorManage, async (req, res) => {
    const admin = await Admin.findById(req.user.id).select('+twoFactorPendingSecret');
    if (!admin) return res.status(401).json({ message: 'This account no longer exists' });
    if (admin.twoFactorEnabled) return res.status(400).json({ message: 'Two factor authentication is already on.' });
    if (!admin.twoFactorPendingSecret) return res.status(400).json({ message: 'Start the setup again to get a new QR code.' });

    const step = matchTotp(decryptSecret(admin.twoFactorPendingSecret), req.body?.code);
    if (step === null) return res.status(400).json({ message: WRONG_CODE });

    const { codes, stored } = generateBackupCodes();
    const updated = await Admin.findByIdAndUpdate(
      admin._id,
      {
        $set: {
          twoFactorEnabled: true,
          twoFactorSecret: admin.twoFactorPendingSecret,
          twoFactorPendingSecret: null,
          lastTotpStep: step,
          backupCodes: stored,
        },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' },
    );

    // Sessions on other devices were started without the second factor, so end them
    await revokeAllForAdmin(admin._id, '2fa-enabled');
    await establishLogin(req, res, updated);

    return res.json({
      message: 'Two factor authentication is on.',
      backupCodes: codes,
      admin: toAccount(updated),
    });
  });

  router.post('/backup-codes', protect, limit.twoFactorManage, async (req, res) => {
    const admin = await Admin.findById(req.user.id).select('+twoFactorSecret');
    if (!admin) return res.status(401).json({ message: 'This account no longer exists' });
    if (!admin.twoFactorEnabled) return res.status(400).json({ message: 'Two factor authentication is off.' });

    if (!(await acceptTotp(admin._id, admin.twoFactorSecret, req.body?.code))) {
      return res.status(400).json({ message: WRONG_CODE });
    }

    const { codes, stored } = generateBackupCodes();
    await Admin.updateOne({ _id: admin._id }, { $set: { backupCodes: stored } });
    return res.json({ message: 'New backup codes created. The old ones no longer work.', backupCodes: codes });
  });

  router.post('/disable', protect, limit.twoFactorManage, async (req, res) => {
    const { password, code } = req.body || {};
    if (typeof password !== 'string' || !password) return res.status(400).json({ message: 'Password is required' });

    const admin = await Admin.findById(req.user.id).select('+password +twoFactorSecret');
    if (!admin) return res.status(401).json({ message: 'This account no longer exists' });
    if (!admin.twoFactorEnabled) return res.status(400).json({ message: 'Two factor authentication is already off.' });

    const { ok } = await verifyPassword(admin.password, password);
    if (!ok) return res.status(400).json({ message: 'Incorrect password' });

    const codeOk = (await acceptTotp(admin._id, admin.twoFactorSecret, code)) || (await consumeBackupCode(admin._id, code));
    if (!codeOk) return res.status(400).json({ message: WRONG_CODE });

    const updated = await Admin.findByIdAndUpdate(
      admin._id,
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorPendingSecret: null,
          lastTotpStep: null,
          backupCodes: [],
        },
      },
      { returnDocument: 'after' },
    );
    return res.json({ message: 'Two factor authentication is off.', admin: toAccount(updated) });
  });

  // Second step of a login, with either an app code or a backup code
  async function secondFactor(req, res, useBackupCode) {
    const preAuth = await findPreAuth(req);
    if (!preAuth) {
      await endPreAuth(res, null);
      return res.status(401).json({ message: SIGN_IN_AGAIN });
    }

    const admin = await Admin.findById(preAuth.admin).select('+twoFactorSecret');
    if (!admin || !admin.twoFactorEnabled) {
      await endPreAuth(res, preAuth);
      return res.status(401).json({ message: SIGN_IN_AGAIN });
    }

    const lockedFor = lockRemainingMs(admin);
    if (lockedFor > 0) {
      await endPreAuth(res, preAuth);
      return sendLocked(res, lockedFor);
    }

    const code = req.body?.code;
    const ok = useBackupCode
      ? await consumeBackupCode(admin._id, code)
      : await acceptTotp(admin._id, admin.twoFactorSecret, code);

    if (!ok) {
      const lock = await recordFailedLogin(admin._id);
      if (lock.locked) {
        await endPreAuth(res, preAuth);
        return sendLocked(res, lock.lockoutUntil - Date.now());
      }
      if (!(await recordPreAuthFailure(preAuth))) {
        await endPreAuth(res, null);
        return res.status(401).json({ message: 'Too many wrong codes. Please enter your password again.' });
      }
      return res.status(400).json({ message: WRONG_CODE });
    }

    // Claim the pre-auth token so two requests can't both finish the login
    const claimed = await PreAuthToken.findOneAndDelete({ _id: preAuth._id });
    await endPreAuth(res, null);
    if (!claimed) return res.status(401).json({ message: SIGN_IN_AGAIN });

    const updated = await completeLogin(req, res, admin._id);
    const body = { message: 'Login successful', admin: toAccount(updated) };
    if (useBackupCode) body.backupCodesLeft = await backupCodesLeft(admin._id);
    return res.json(body);
  }

  router.post('/verify', limit.twoFactorVerify, (req, res) => secondFactor(req, res, false));
  router.post('/recover', limit.twoFactorVerify, (req, res) => secondFactor(req, res, true));

  return router;
}

module.exports = { createTwoFactorRouter };
