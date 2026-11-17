// Only lets the request through if the session belongs to a logged-in admin
const protect = (req, res, next) => {
  if (req.session && req.session.admin) {
    req.user = req.session.admin;
    return next();
  }
  res.status(401).json({ message: 'Not authorized, please log in' });
};

module.exports = { protect };
