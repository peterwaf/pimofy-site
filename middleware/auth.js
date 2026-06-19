// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.status(401).redirect('/auth/login');
  }
  next();
}

// Middleware to check if user is admin
function isAdmin(req, res, next) {
  if (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'superadmin')) {
    return res.status(403).render('pages/403', {
      title: 'Access Denied',
      description: 'You do not have permission to access this resource.',
    });
  }
  next();
}

// Middleware to check if user is superadmin
function isSuperAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    return res.status(403).render('pages/403', {
      title: 'Access Denied',
      description: 'You do not have permission to access this resource.',
    });
  }
  next();
}

module.exports = {
  isAuthenticated,
  isAdmin,
  isSuperAdmin,
};
