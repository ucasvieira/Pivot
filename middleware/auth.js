
function ensureProfileComplete(req, res, next) {
  console.log('🔍 Checking profile completion for user:', req.user ? req.user.id : 'not authenticated');
  console.log('📋 Profile complete status:', req.user ? req.user.is_profile_complete : 'N/A');
  
  if (req.user && !req.user.is_profile_complete) {
    console.log('❌ Profile incomplete, redirecting to setup');
    req.flash('info', 'Por favor, complete seu perfil para continuar');
    return res.redirect('/profile/setup');
  }
  
  console.log('✅ Profile complete, proceeding');
  next();
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
