
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { ensureAuthenticated } = require('../middleware/auth');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');

// Profile setup page
router.get('/setup', ensureAuthenticated, async (req, res) => {
  try {
    const skills = await Skill.getAll();
    const userProfile = await Profile.findByUserId(req.user.id);
    const userSkills = await Skill.getUserSkills(req.user.id);

    res.render('profile/setup', {
      title: 'Complete Your Profile',
      user: req.user,
      profile: userProfile,
      skills,
      userSkills
    });
  } catch (error) {
    console.error('Profile setup error:', error);
    req.flash('error', 'Error loading profile setup');
    res.redirect('/dashboard');
  }
});

// Profile setup handler
router.post('/setup', ensureAuthenticated, [
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
      return res.redirect('/profile/setup');
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

    // Create or update profile
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

    // Mark profile as complete
    await User.updateProfileComplete(req.user.id, true);

    req.flash('success', 'Profile completed successfully!');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Profile setup error:', error);
    req.flash('error', 'Error saving profile');
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
