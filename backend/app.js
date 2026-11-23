const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const config = require('./config');
const { protect } = require('./middleware/authMiddleware');
const { createAuthRouter } = require('./routes/auth');
const { createMailer } = require('./services/mailer');

// Builds the app without connecting to MongoDB, so tests can make a fresh one
function createApp({ sessionStore, mailer = createMailer(), rateLimits = {} } = {}) {
  const app = express();

  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(cors({
    origin: config.clientUrls,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.use(session({
    name: config.session.cookieName,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: config.session.idleMinutes * 60 * 1000,
    },
  }));

  app.get('/', (req, res) => {
    res.send('UniGuide Cameroon Backend is running! 🚀');
  });

  app.use('/api/auth', createAuthRouter({
    mailer,
    rateLimits: { ...config.rateLimits, ...rateLimits },
  }));

  app.get('/api/admin/secret-dashboard', protect, (req, res) => {
    res.json({
      message: 'Welcome to the secret admin dashboard!',
      adminEmail: req.user.email,
    });
  });

  // Express 5 sends errors from async handlers here
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'The request body is not valid JSON' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ message: 'The request body is too large' });
    }
    console.error('UNHANDLED ERROR:', err);
    return res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
  });

  return app;
}

module.exports = { createApp };
