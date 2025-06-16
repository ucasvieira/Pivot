
const express = require('express');
const router = express.Router();
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const { ensureGuest } = require('../middleware/auth');
const User = require('../models/User');

// Registration page
router.get('/register', ensureGuest, (req, res) => {
  res.render('auth/register', { title: 'Register' });
});

// Registration handler
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('user_type').isIn(['idealizer', 'collaborator'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Please check your input');
      return res.redirect('/auth/register');
    }

    const { email, password, user_type } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      req.flash('error', 'User with this email already exists');
      return res.redirect('/auth/register');
    }

    // Create new user
    const user = await User.create({ email, password, user_type });
    
    req.login(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        req.flash('error', 'Registration successful, please log in');
        return res.redirect('/auth/login');
      }
      req.flash('success', 'Registration successful! Please complete your profile');
      res.redirect('/profile/setup');
    });
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'Registration failed');
    res.redirect('/auth/register');
  }
});

// Login page
router.get('/login', ensureGuest, (req, res) => {
  res.render('auth/login', { title: 'Login' });
});

// Login handler
router.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/auth/login',
  failureFlash: true
}), (req, res) => {
  console.log('Login successful for user:', req.user);
  // ... resto do código
});

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback', passport.authenticate('github', {
  failureRedirect: '/auth/login',
  failureFlash: true
}), (req, res) => {
  if (!req.user.is_profile_complete) {
    res.redirect('/profile/setup');
  } else {
    res.redirect('/dashboard');
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', {
  failureRedirect: '/auth/login',
  failureFlash: true
}), (req, res) => {
  if (!req.user.is_profile_complete) {
    res.redirect('/profile/setup');
  } else {
    res.redirect('/dashboard');
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    req.flash('success', 'You have been logged out');
    res.redirect('/');
  });
});

module.exports = router;
