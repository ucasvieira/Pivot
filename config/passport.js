
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email'
}, async (email, password, done) => {
  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return done(null, false, { message: 'No user found with that email' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return done(null, false, { message: 'Password incorrect' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// GitHub Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: `${process.env.APP_URL}/auth/github/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findByGitHubId(profile.id);
    
    if (user) {
      return done(null, user);
    }

    // Create new user
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    user = await User.create({
      email: email,
      github_id: profile.id,
      user_type: 'collaborator' // Default for GitHub users
    });

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.APP_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findByGoogleId(profile.id);
    
    if (user) {
      return done(null, user);
    }

    // Create new user
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    user = await User.create({
      email: email,
      google_id: profile.id,
      user_type: 'collaborator' // Default for Google users
    });

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  console.log('Serializing user:', { id: user.id, email: user.email });
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log('Deserializing user ID:', id);
    const user = await User.findById(id);
    console.log('Found user during deserialize:', user ? 'YES' : 'NO');
    done(null, user);
  } catch (error) {
    console.error('Deserialize error:', error);
    done(error);
  }
});