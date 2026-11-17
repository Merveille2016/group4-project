const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
require('dotenv').config();
const { protect } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/auth');

const app = express();

// Logged out after this many minutes without a request (keep in sync with VITE_IDLE_MINUTES on the frontend)
const IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES) || 5;

// The session cookie only works if CORS names the exact frontend origin
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174').split(',');

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(session({
  name: 'uniguide.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // every request pushes the expiry back, so it acts as an idle timeout
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI, collectionName: 'sessions' }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: IDLE_MINUTES * 60 * 1000
  }
}));

// Test route
app.get('/', (req, res) => {
  res.send('UniGuide Cameroon Backend is running! 🚀');
});

// Routes
app.use('/api/auth', authRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log('Database Name:', mongoose.connection.db.databaseName);
       // A protected route that ONLY logged-in admins can see
   app.get('/api/admin/secret-dashboard', protect, (req, res) => {
     res.json({ 
       message: 'Welcome to the secret admin dashboard!', 
       adminEmail: req.user.email 
     });
   });
    
    // Start the server (Make sure it says 'app.listen', NOT 'apcdp.listen')
    app.listen(process.env.PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ FAILED to connect to MongoDB:');
    console.error(error.message);
  });