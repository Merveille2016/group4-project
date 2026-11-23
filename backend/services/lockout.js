const Admin = require('../models/Admin');
const config = require('../config');

function lockRemainingMs(admin, now = Date.now()) {
  if (!admin.lockoutUntil) return 0;
  return Math.max(0, new Date(admin.lockoutUntil).getTime() - now);
}

// $inc so parallel wrong guesses can't slip past the threshold
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
