const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const bcrypt = require('bcrypt');
const { protect } = require('../middleware/authMiddleware');

// ==========================================
// 1. ADMIN SIGNUP ROUTE
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }

    // 1. Hash the password manually right here
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 2. Save the hashed password to the database
    const newAdmin = new Admin({ name, email, password: hashedPassword });
    await newAdmin.save();

    res.status(201).json({ message: 'Admin registered successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// ==========================================
// 2. ADMIN LOGIN ROUTE (This was missing!)
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // 2. Check if password matches the hashed password in the database
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // 3. Start a fresh session (new id, so an old cookie can't be reused)
    const account = { id: admin._id, name: admin.name, email: admin.email, role: admin.role };
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ message: 'Server error during login', error: err.message });
      }
      req.session.admin = account;
      res.json({ message: 'Login successful', admin: account });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// ==========================================
// 3. CURRENT USER (used by the frontend on page load)
// ==========================================
router.get('/me', protect, (req, res) => {
  res.json({ admin: req.user });
});

// ==========================================
// 4. LOGOUT
// ==========================================
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Server error during logout', error: err.message });
    }
    res.clearCookie('uniguide.sid');
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;