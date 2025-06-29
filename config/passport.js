const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Serialize/Deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email'
}, async (email, password, done) => {
  try {
    console.log('🔍 Local strategy - searching user:', email);
    const user = await User.findByEmail(email);
    
    if (!user) {
      console.log('❌ User not found:', email);
      return done(null, false, { message: 'Email não encontrado' });
    }

    console.log('✅ User found:', { id: user.id, email: user.email });

    // Verificar se usuário tem senha (pode ser OAuth)
    if (!user.password) {
      console.log('❌ User has no password (OAuth user):', email);
      return done(null, false, { message: 'Use login social para esta conta' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔐 Password match:', isMatch);
    
    if (!isMatch) {
      console.log('❌ Password mismatch for:', email);
      return done(null, false, { message: 'Senha incorreta' });
    }

    console.log('✅ Authentication successful for:', email);
    return done(null, user);
  } catch (error) {
    console.error('❌ Local strategy error:', error);
    return done(error);
  }
}));

// Google Strategy (apenas se as variáveis estiverem configuradas)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.APP_URL}/auth/google/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Verificar se usuário já existe
      let user = await User.findByGoogleId(profile.id);
      
      if (user) {
        return done(null, user);
      }

      // Verificar se existe usuário com mesmo email
      user = await User.findByEmail(profile.emails[0].value);
      
      if (user) {
        // Vincular conta Google ao usuário existente
        await User.linkGoogleAccount(user.id, profile.id);
        user.google_id = profile.id;
        return done(null, user);
      }

      // Criar novo usuário
      const newUser = await User.createFromGoogle({
        google_id: profile.id,
        email: profile.emails[0].value,
        user_type: 'collaborator' // padrão
      });

      return done(null, newUser);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.log('⚠️  Google OAuth não configurado - variáveis de ambiente ausentes');
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

      // Criar novo usuário
      const newUser = await User.createFromGitHub({
        github_id: profile.id,
        email: email,
        user_type: 'collaborator' // padrão
      });

      return done(null, newUser);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.log('⚠️  GitHub OAuth não configurado - variáveis de ambiente ausentes');
}

module.exports = passport;