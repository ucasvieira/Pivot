
const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureProfileComplete } = require('../middleware/auth');
const User = require('../models/User');
const Project = require('../models/Project');
const Match = require('../models/Match');

// Home page
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('index', { title: 'Pivot - Connect Ideas with Talent' });
});

// Dashboard
router.get('/dashboard', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const user = req.user;
    let dashboardData = {};

    if (user.user_type === 'idealizer') {
      // Get user's projects and match statistics
      const projects = await Project.findByIdealizerId(user.id);
      const matches = await Match.getUserMatches(user.id, 'idealizer');
      
      dashboardData = {
        projects,
        matches,
        totalProjects: projects.length,
        totalMatches: matches.length,
        acceptedMatches: matches.filter(m => m.status === 'accepted').length
      };
    } else {
      // Get available projects and user's matches
      const availableProjects = await Project.getProjectsForMatching(user.id);
      const matches = await Match.getUserMatches(user.id, 'collaborator');
      
      dashboardData = {
        availableProjects: availableProjects.slice(0, 5), // Show first 5
        matches,
        totalMatches: matches.length,
        acceptedMatches: matches.filter(m => m.status === 'accepted').length
      };
    }

    res.render('dashboard', {
      title: 'Dashboard',
      user,
      ...dashboardData
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard');
    res.redirect('/');
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about', { title: 'About Pivot' });
});

module.exports = router;
