const mongoose = require('mongoose');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const adminSchema = new mongoose.Schema({
  // Required by the register route, not here: accounts created before names
  // existed have none, and they still need to be able to log in.
  name: { type: String, trim: true, maxlength: 100 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: EMAIL_PATTERN,
  },
  // argon2id hash. Older accounts may still hold a bcrypt hash until their next login.
  // Never returned by queries unless asked for with .select('+password').
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin'], default: 'admin' },

  // Bumped on every login, logout and password reset. Sessions and refresh tokens
  // remember the version they were issued under and stop working once it changes.
  tokenVersion: { type: Number, default: 0 },

  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },

  passwordChangedAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

adminSchema.statics.EMAIL_PATTERN = EMAIL_PATTERN;

module.exports = mongoose.model('Admin', adminSchema);
