const Admin = require('../models/Admin');

// Old sessions stop working once tokenVersion has moved on
const protect = async (req, res, next) => {
  const account = req.session?.admin;
  if (!account) {
    return res.status(401).json({ message: 'Not authorized, please log in' });
  }

  const admin = await Admin.findById(account.id).select('tokenVersion');
  if (!admin || admin.tokenVersion !== account.tokenVersion) {
    const message = admin ? 'Your session has ended. Please log in again.' : 'This account no longer exists';
    return req.session.destroy(() => res.status(401).json({ message }));
  }

  req.user = account;
  next();
};

module.exports = { protect };
