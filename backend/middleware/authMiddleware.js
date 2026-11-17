const Admin = require('../models/Admin');

// Only lets the request through if the session belongs to a logged in admin
// whose account still exists (it may have been deleted from another device)
const protect = async (req, res, next) => {
  if (!req.session || !req.session.admin) {
    return res.status(401).json({ message: 'Not authorized, please log in' });
  }

  try {
    const exists = await Admin.exists({ _id: req.session.admin.id });
    if (!exists) {
      return req.session.destroy(() => {
        res.status(401).json({ message: 'This account no longer exists' });
      });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }

  req.user = req.session.admin;
  next();
};

module.exports = { protect };
