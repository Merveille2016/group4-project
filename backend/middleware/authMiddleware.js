const Admin = require('../models/Admin');

// Only lets the request through if the session belongs to an admin whose account still
// exists and whose tokenVersion hasn't moved on. tokenVersion changes on every login,
// logout and password reset, so an old session (another device, a stolen cookie)
// stops working on its next request.
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
