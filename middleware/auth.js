
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to access this page');
  res.redirect('/auth/login');
}

function ensureGuest(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  next();
}

function ensureProfileComplete(req, res, next) {
  if (req.user && !req.user.is_profile_complete) {
    req.flash('info', 'Please complete your profile to continue');
    return res.redirect('/profile/setup');
  }
  next();
}

function ensureUserType(userType) {
  return (req, res, next) => {
    if (req.user && req.user.user_type === userType) {
      return next();
    }
    req.flash('error', 'Access denied');
    res.redirect('/dashboard');
  };
}

module.exports = {
  ensureAuthenticated,
  ensureGuest,
  ensureProfileComplete,
  ensureUserType
};
