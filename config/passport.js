
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    console.log('🔍 Local strategy - searching user:', email);
    const user = await User.findByEmail(email);
    console.log('Executing query: SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      console.log('❌ User not found:', email);
      return done(null, false, { message: 'Usuário não encontrado' });
    }
    console.log('✅ User found:', user);
    
    // Debug logs for password verification
    console.log('🔍 Password entered:', password);
    console.log('🔍 Hashed password in database:', user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔐 Password match:', isMatch);
    if (!isMatch) {
      console.log('❌ Password mismatch for:', email);
      return done(null, false, { message: 'Senha incorreta' });
    }
    return done(null, user);
  } catch (error) {
    console.error('Error in local strategy:', error);
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Google Strategy (apenas se as variáveis estiverem configuradas)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔍 Google OAuth - Profile received:', {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName
      });
      
      // Verificar se usuário já existe
      let user = await User.findByGoogleId(profile.id);
      
      if (user) {
        console.log('✅ Existing Google user found:', user.id);
        return done(null, user);
      }
      
      // Verificar se existe usuário com mesmo email
      user = await User.findByEmail(profile.emails[0].value);
      
      if (user) {
        console.log('📧 User with same email exists, linking Google account');
        return done(null, false, { message: 'Email já está em uso com outro método de login' });
      }
      
      // Criar novo usuário SEM user_type definido
      console.log('➕ Creating new Google user');
      user = await User.create({
        email: profile.emails[0].value,
        password: null,
        user_type: null, // ← Mudança aqui: não definir tipo ainda
        google_id: profile.id
      });
      
      console.log('✅ New Google user created:', user.id);
      return done(null, user);
      
    } catch (error) {
      console.error('❌ Google OAuth error:', error);
      return done(error);
    }
  }));
}

// GitHub Strategy (apenas se as variáveis estiverem configuradas)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.APP_URL}/auth/github/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Verificar se usuário já existe
      let user = await User.findByGitHubId(profile.id);
      
      if (user) {
        return done(null, user);
      }

      // Verificar se existe usuário com mesmo email
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (email) {
        user = await User.findByEmail(email);
        
        if (user) {
          // Vincular conta GitHub ao usuário existente
          await User.linkGitHubAccount(user.id, profile.id);
          user.github_id = profile.id;
          return done(null, user);
        }
      }

      // Criar novo usuário SEM user_type definido
      const newUser = await User.createFromGitHub({
        github_id: profile.id,
        email: email,
        user_type: null // ← Mudança aqui: não definir tipo ainda
      });

      return done(null, newUser);
    } catch (error) {
      return done(error, null);
    }
  }));
}

module.exports = passport;