const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Loads variables from your .env file

const app = express();

// Middleware (allows frontend to talk to backend, and allows JSON data)
app.use(cors());
app.use(express.json());

// A simple test route to make sure the server is working
app.get('/', (req, res) => {
  res.send('UniGuide Cameroon Backend is running! 🚀');
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log('Database Name:', mongoose.connection.db.databaseName);
    
    // Start the server ONLY after MongoDB connects successfully
    apcdp.listen(process.env.PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ FAILED to connect to MongoDB:');
    console.error(error.message);
  });