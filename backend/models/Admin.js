const mongoose = require('mongoose');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const adminSchema = new mongoose.Schema({
  // Not required here because older accounts have no name
  name: { type: String, trim: true, maxlength: 100 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: EMAIL_PATTERN,
  },
  // argon2id, or bcrypt for old accounts until their next login
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin'], default: 'admin' },

  // Bumped on login, logout and password reset to end older sessions
  tokenVersion: { type: Number, default: 0 },

  twoFactorEnabled: { type: Boolean, default: false },
  // Encrypted TOTP secret, and one waiting to be confirmed during enrolment
  twoFactorSecret: { type: String, default: null, select: false },
  twoFactorPendingSecret: { type: String, default: null, select: false },
  // Last accepted TOTP time step, so a code can't be used twice
  lastTotpStep: { type: Number, default: null },
  backupCodes: {
    type: [{ _id: false, hash: String, usedAt: { type: Date, default: null } }],
    default: [],
    select: false,
  },

  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },

  passwordChangedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

adminSchema.statics.EMAIL_PATTERN = EMAIL_PATTERN;

module.exports = mongoose.model('Admin', adminSchema);
