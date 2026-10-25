const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { protect } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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