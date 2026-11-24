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
    // Both frontends read `message` from error responses
    handler: (req, res) => res.status(429).json({ message }),
  });
}

const byIp = (req) => ipKeyGenerator(req.ip);

// Each endpoint gets its own limiter (and its own counters), created per app instance
function createRateLimiters(limits = defaultConfig.rateLimits) {
  return {
    // Only failed attempts count, so a person who logs in fine is never blocked
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

    // Two limits: one per network, and one per email address so a single inbox
    // can't be flooded with reset emails from many networks
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
