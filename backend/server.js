const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. Middleware (Crucial for reading JSON)
app.use(cors());
app.use(express.json()); 

// 2. Connect to Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ SUCCESS: Connected to MongoDB Atlas!'))
  .catch((err) => console.log('❌ FAILED to connect to MongoDB:', err.message));

// 3. THE BRIDGE (This connects your server to auth.js)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// 4. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});