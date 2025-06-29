const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();

// Middleware para verificar se OAuth está disponível
const checkOAuthAvailable = (provider) => {
  return (req, res, next) => {
    const isGoogleAvailable = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
    const isGitHubAvailable = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;
    
    if (provider === 'google' && !isGoogleAvailable) {
      req.flash('error', 'Login com Google não está disponível no momento');
      return res.redirect('/auth/login');
    }
    
    if (provider === 'github' && !isGitHubAvailable) {
      req.flash('error', 'Login com GitHub não está disponível no momento');
      return res.redirect('/auth/login');
    }
    
    next();
  };
};

// Login page
router.get('/login', (req, res) => {
  const isGoogleAvailable = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  const isGitHubAvailable = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;
  
  res.render('auth/login', { 
    title: 'Login',
    isGoogleAvailable,
    isGitHubAvailable
  });
});

// Register page
router.get('/register', (req, res) => {
  res.render('auth/register', { title: 'Cadastro' });
});

// Local login
router.post('/login', 
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Senha é obrigatória')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/auth/login');
    }
    
    passport.authenticate('local', {
      successRedirect: '/profile/setup',
      failureRedirect: '/auth/login',
      failureFlash: true
    })(req, res, next);
  }
);

// Local register
router.post('/register',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
    body('user_type').isIn(['idealizer', 'collaborator']).withMessage('Tipo de usuário inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array()[0].msg);
        return res.redirect('/auth/register');
      }

      const { email, password, user_type } = req.body;

      // Verificar se usuário já existe
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        req.flash('error', 'Email já está em uso');
        return res.redirect('/auth/register');
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Criar usuário
      const user = await User.create({
        email,
        password: hashedPassword,
        user_type
      });

      // Login automático
      req.login(user, (err) => {
        if (err) {
          req.flash('error', 'Erro ao fazer login');
          return res.redirect('/auth/login');
        }
        res.redirect('/profile/setup');
      });

    } catch (error) {
      console.error('Erro no registro:', error);
      req.flash('error', 'Erro interno do servidor');
      res.redirect('/auth/register');
    }
  }
);

// Google OAuth routes (apenas se configurado)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', 
    checkOAuthAvailable('google'),
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    (req, res) => {
      console.log('🔍 Google callback - User:', req.user ? req.user.id : 'not authenticated');
      console.log('📋 Profile complete:', req.user ? req.user.is_profile_complete : 'N/A');
      
      // Sempre redirecionar para profile/setup - o middleware decidirá se precisa configurar
      res.redirect('/profile/setup');
    }
  );
}

// GitHub OAuth routes (apenas se configurado)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  router.get('/github',
    checkOAuthAvailable('github'),
    passport.authenticate('github', { scope: ['user:email'] })
  );

  router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/auth/login' }),
    (req, res) => {
      res.redirect('/profile/setup');
    }
  );
}

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Erro no logout:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;