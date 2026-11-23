const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const isProduction = process.env.NODE_ENV === 'production';
const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}
if (isProduction && !process.env.TWO_FACTOR_KEY) {
  throw new Error('TWO_FACTOR_KEY must be set in production');
}

module.exports = {
  isProduction,
  clientUrls,
  appUrl: process.env.APP_URL || clientUrls[0],
  trustProxy: process.env.TRUST_PROXY || false,

  session: {
    cookieName: 'uniguide.sid',
    secret: process.env.SESSION_SECRET || 'uniguide-dev-only-secret-change-me',
    idleMinutes: num(process.env.SESSION_IDLE_MINUTES, 5),
  },

  refreshToken: {
    cookieName: 'uniguide.rt',
    cookiePath: '/api/auth',
    days: num(process.env.REFRESH_TOKEN_DAYS, 7),
    // Two tabs refreshing at once send the same token, so allow a short overlap
    reuseGraceSeconds: 10,
  },

  passwordReset: {
    minutes: num(process.env.PASSWORD_RESET_MINUTES, 30),
  },

  password: {
    minLength: 8,
    maxLength: 128,
  },

  preAuth: {
    cookieName: 'uniguide.pa',
    cookiePath: '/api/auth/2fa',
    minutes: 5,
    maxAttempts: 5,
  },

  twoFactor: {
    issuer: 'UniGuide Cameroon',
    // Used to encrypt TOTP secrets in the database
    key: process.env.TWO_FACTOR_KEY || 'uniguide-dev-only-2fa-key-change-me',
    backupCodeCount: 10,
  },

  lockout: {
    threshold: num(process.env.LOCKOUT_THRESHOLD, 5),
    minutes: num(process.env.LOCKOUT_MINUTES, 15),
  },

  rateLimits: {
    login: { windowMinutes: 15, max: 10 },
    register: { windowMinutes: 60, max: 5 },
    refresh: { windowMinutes: 15, max: 60 },
    forgotPassword: { windowMinutes: 15, max: 5 },
    forgotPasswordPerEmail: { windowMinutes: 60, max: 3 },
    resetPassword: { windowMinutes: 15, max: 10 },
    twoFactorVerify: { windowMinutes: 15, max: 10 },
    twoFactorManage: { windowMinutes: 15, max: 20 },
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'UniGuide Cameroon <no-reply@uniguide.cm>',
  },
};
