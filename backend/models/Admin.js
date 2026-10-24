const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }, // Can be 'admin' or 'super_admin'
  createdAt: { type: Date, default: Date.now }
});

// 🔒 SECURITY: Automatically hash the password BEFORE saving to the database
adminSchema.pre('save', async function(next) {
  // Only hash if the password is new or modified
  if (!this.isModified('password')) return next();
  
  // Generate a salt and hash the password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('Admin', adminSchema);