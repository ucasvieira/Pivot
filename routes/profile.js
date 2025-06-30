
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { ensureAuthenticated, ensureProfileComplete } = require('../middleware/auth');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');

// Profile setup page
router.get('/setup', ensureAuthenticated, async (req, res) => {
  try {
    console.log('🔍 Profile setup page for user:', req.user.id);
    console.log('👤 User profile complete status:', req.user.is_profile_complete);
    
    // Se o perfil já está completo, redirecionar para dashboard
    if (req.user.is_profile_complete) {
      console.log('✅ Profile already complete, redirecting to dashboard');
      return res.redirect('/dashboard');
    }

    // Verificar se já existe um perfil (pode estar incompleto)
    const Profile = require('../models/Profile');
    const existingProfile = await Profile.findByUserId(req.user.id);
    
    // Buscar todas as skills disponíveis
    const skills = await Skill.getAll();
    
    // Buscar skills do usuário (pode ser vazio para novos usuários)
    const userSkills = await Skill.getUserSkills(req.user.id) || [];
    
    console.log('📋 Existing profile data:', existingProfile ? 'Found' : 'Not found');
    console.log('🎯 Skills loaded:', skills ? skills.length : 0);
    console.log('👤 User skills loaded:', userSkills ? userSkills.length : 0);

    res.render('profile/setup', { 
      title: 'Configurar Perfil',
      user: req.user,
      profile: existingProfile || {}, // Passar dados existentes se houver
      skills: skills || [], // Adicionar skills disponíveis
      userSkills: userSkills || [] // Adicionar skills do usuário
    });
  } catch (error) {
    console.error('❌ Profile setup page error:', error);
    req.flash('error', 'Erro ao carregar página de perfil');
    res.redirect('/dashboard');
  }
});

// Profile setup handler
router.post('/setup', ensureAuthenticated, [
  body('first_name').notEmpty().withMessage('Nome é obrigatório'),
  body('last_name').notEmpty().withMessage('Sobrenome é obrigatório'),
  body('bio').isLength({ min: 10 }).withMessage('Bio deve ter pelo menos 10 caracteres'),
  body('location').notEmpty().withMessage('Localização é obrigatória'),
  body('experience_level').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Nível de experiência inválido')
], async (req, res) => {
  try {
    console.log('📝 Profile setup attempt for user:', req.user.id);
    console.log('📋 Form data received:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/profile/setup');
    }

    const {
      first_name, last_name, bio, location, experience_level, availability,
      phone, linkedin, github, portfolio, skills
    } = req.body;

    // Preparar contact_info como JSON
    const contact_info = JSON.stringify({
      phone: phone || '',
      linkedin: linkedin || '',
      github: github || ''
    });

    // Preparar portfolio_links como JSON  
    const portfolio_links = JSON.stringify({
      portfolio: portfolio || ''
    });

    const profileData = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      bio: bio.trim(),
      location: location.trim(),
      experience_level,
      contact_info,
      portfolio_links,
      availability: availability || null
    };

    console.log('💾 Saving profile data:', profileData);

    // Salvar perfil
    await Profile.upsert(req.user.id, profileData);

    // Salvar skills do usuário se for collaborator
    if (req.user.user_type === 'collaborator' && skills) {
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      const skillsData = skillsArray.map(skillId => ({
        skill_id: parseInt(skillId),
        proficiency_level: experience_level // Usar o nível de experiência como proficiência
      }));
      
      console.log('🎯 Saving user skills:', skillsData);
      await Skill.updateUserSkills(req.user.id, skillsData);
    }

    console.log('✅ Profile saved successfully');
    req.flash('success', 'Perfil configurado com sucesso!');
    res.redirect('/dashboard');

  } catch (error) {
    console.error('❌ Profile setup error:', error);
    req.flash('error', 'Erro ao salvar perfil. Tente novamente.');
    res.redirect('/profile/setup');
  }
});

// View profile
router.get('/view/:id?', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const user = await User.getWithProfile(userId);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/dashboard');
    }

    const userSkills = await Skill.getUserSkills(userId);

    res.render('profile/view', {
      title: `${user.first_name} ${user.last_name}`,
      profileUser: user,
      userSkills,
      isOwnProfile: userId == req.user.id
    });
  } catch (error) {
    console.error('Profile view error:', error);
    req.flash('error', 'Error loading profile');
    res.redirect('/dashboard');
  }
});

// Edit profile page
router.get('/edit', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.getWithProfile(req.user.id);
    const skills = await Skill.getAll();
    const userSkills = await Skill.getUserSkills(req.user.id);

    res.render('profile/edit', {
      title: 'Edit Profile',
      user,
      skills,
      userSkills
    });
  } catch (error) {
    console.error('Profile edit error:', error);
    req.flash('error', 'Error loading profile');
    res.redirect('/dashboard');
  }
});

// Edit profile handler
router.post('/edit', ensureAuthenticated, [
  body('first_name').trim().isLength({ min: 1 }),
  body('last_name').trim().isLength({ min: 1 }),
  body('bio').trim().isLength({ min: 10 }),
  body('location').trim().isLength({ min: 1 }),
  body('experience_level').isIn(['beginner', 'intermediate', 'advanced'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Please fill in all required fields correctly');
      return res.redirect('/profile/edit');
    }

    const {
      first_name, last_name, bio, location, experience_level,
      availability, phone, linkedin, github, portfolio,
      skills: selectedSkills
    } = req.body;

    // Prepare contact info and portfolio links
    const contact_info = {
      phone: phone || '',
      linkedin: linkedin || '',
      github: github || ''
    };

    const portfolio_links = {
      portfolio: portfolio || ''
    };

    // Update profile
    const profileData = {
      first_name,
      last_name,
      bio,
      location,
      experience_level,
      contact_info,
      portfolio_links,
      availability: availability || null,
      profile_picture: null
    };

    await Profile.upsert(req.user.id, profileData);

    // Update user skills if user is a collaborator
    if (req.user.user_type === 'collaborator' && selectedSkills) {
      const skillsArray = Array.isArray(selectedSkills) ? selectedSkills : [selectedSkills];
      const skillsData = skillsArray.map(skillId => ({
        skill_id: parseInt(skillId),
        proficiency_level: experience_level
      }));
      await Skill.updateUserSkills(req.user.id, skillsData);
    }

    req.flash('success', 'Profile updated successfully!');
    res.redirect('/profile/view');
  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error', 'Error updating profile');
    res.redirect('/profile/edit');
  }
});

module.exports = router;
