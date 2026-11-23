const Admin = require('../models/Admin');
const config = require('../config');

// Per-account lockout: after `threshold` wrong passwords the account refuses logins
// for `minutes`, no matter which IP they come from. This complements the per-IP
// rate limiter, which can't stop an attacker spreading guesses across many IPs.

function lockRemainingMs(admin, now = Date.now()) {
  if (!admin.lockoutUntil) return 0;
  return Math.max(0, new Date(admin.lockoutUntil).getTime() - now);
}

// Counts the failure atomically ($inc) so parallel wrong guesses can't slip past the
// threshold. Locking resets the counter, so the account gets a fresh set of attempts
// once the lock expires.
async function recordFailedLogin(adminId, { threshold, minutes } = config.lockout) {
  const updated = await Admin.findByIdAndUpdate(
    adminId,
    { $inc: { failedLoginAttempts: 1 } },
    { returnDocument: 'after', projection: { failedLoginAttempts: 1 } },
  );
  if (!updated) return { locked: false, attemptsLeft: 0 };

  if (updated.failedLoginAttempts >= threshold) {
    const lockoutUntil = new Date(Date.now() + minutes * 60 * 1000);
    await Admin.updateOne(
      { _id: adminId, failedLoginAttempts: { $gte: threshold } },
      { $set: { lockoutUntil, failedLoginAttempts: 0 } },
    );
    return { locked: true, lockoutUntil };
  }

  return { locked: false, attemptsLeft: threshold - updated.failedLoginAttempts };
}

function clearFailedLogins(adminId) {
  return Admin.updateOne({ _id: adminId }, { $set: { failedLoginAttempts: 0, lockoutUntil: null } });
}

module.exports = { lockRemainingMs, recordFailedLogin, clearFailedLogins };
