const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const defaultConfig = require('../config');
const { normalizeEmail } = require('../services/validation');

function makeLimiter({ windowMinutes, max }, { message, keyGenerator, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator,
    handler: (req, res) => res.status(429).json({ message }),
  });
}

const byIp = (req) => ipKeyGenerator(req.ip);

function createRateLimiters(limits = defaultConfig.rateLimits) {
  return {
    // Only failed attempts count
    login: makeLimiter(limits.login, {
      message: `Too many failed login attempts from this network. Try again in ${limits.login.windowMinutes} minutes.`,
      keyGenerator: byIp,
      skipSuccessfulRequests: true,
    }),

    register: makeLimiter(limits.register, {
      message: 'Too many accounts created from this network. Please try again later.',
      keyGenerator: byIp,
    }),

    refresh: makeLimiter(limits.refresh, {
      message: 'Too many session refreshes. Please log in again.',
      keyGenerator: byIp,
    }),

    // Also per email so one inbox can't be flooded from many networks
    forgotPasswordByIp: makeLimiter(limits.forgotPassword, {
      message: 'Too many password reset requests. Please try again later.',
      keyGenerator: byIp,
    }),
    forgotPasswordByEmail: makeLimiter(limits.forgotPasswordPerEmail, {
      message: 'Too many password reset requests for this email. Please try again later.',
      keyGenerator: (req) => `email:${normalizeEmail(req.body?.email) || byIp(req)}`,
    }),

    resetPassword: makeLimiter(limits.resetPassword, {
      message: 'Too many password reset attempts. Please try again later.',
      keyGenerator: byIp,
    }),
  };
}

module.exports = { createRateLimiters };
