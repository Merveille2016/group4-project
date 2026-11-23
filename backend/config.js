// Every auth-related setting in one place, read from the environment with safe defaults.
// Tests override pieces of this through createApp({ config }).

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

module.exports = {
  isProduction,
  clientUrls,
  // Where the password reset link in the email points (the frontend's reset page)
  appUrl: process.env.APP_URL || clientUrls[0],
  trustProxy: process.env.TRUST_PROXY || false,

  session: {
    cookieName: 'uniguide.sid',
    secret: process.env.SESSION_SECRET || 'uniguide-dev-only-secret-change-me',
    idleMinutes: num(process.env.SESSION_IDLE_MINUTES, 5),
  },

  refreshToken: {
    cookieName: 'uniguide.rt',
    // Only sent to the auth routes, never to the rest of the API
    cookiePath: '/api/auth',
    days: num(process.env.REFRESH_TOKEN_DAYS, 7),
    // Two tabs refreshing at once both present the same token; the slower one
    // gets a 401 instead of being treated as a stolen token inside this window
    reuseGraceSeconds: 10,
  },

  passwordReset: {
    minutes: num(process.env.PASSWORD_RESET_MINUTES, 30),
  },

  password: {
    minLength: 8,
    maxLength: 128,
  },

  lockout: {
    threshold: num(process.env.LOCKOUT_THRESHOLD, 5),
    minutes: num(process.env.LOCKOUT_MINUTES, 15),
  },

  // Each auth endpoint gets its own limiter so one can't use up another's budget
  rateLimits: {
    login: { windowMinutes: 15, max: 10 },
    register: { windowMinutes: 60, max: 5 },
    refresh: { windowMinutes: 15, max: 60 },
    forgotPassword: { windowMinutes: 15, max: 5 },
    forgotPasswordPerEmail: { windowMinutes: 60, max: 3 },
    resetPassword: { windowMinutes: 15, max: 10 },
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'UniGuide Cameroon <no-reply@uniguide.cm>',
  },
};
