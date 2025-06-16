
const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureProfileComplete } = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User');
const Match = require('../models/Match');
const SwipeHistory = require('../models/SwipeHistory');
const Skill = require('../models/Skill');

// Swipe interface for collaborators
router.get('/swipe', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    let items = [];
    let swipeType = 'projects';

    if (req.user.user_type === 'collaborator') {
      // Show projects to collaborators
      items = await Project.getProjectsForMatching(req.user.id);
      swipeType = 'projects';
    } else {
      // Show collaborators to idealizers
      items = await User.getAllCollaborators(req.user.id);
      swipeType = 'collaborators';
    }

    res.render('match/swipe', {
      title: 'Discover Matches',
      items,
      swipeType,
      userType: req.user.user_type
    });
  } catch (error) {
    console.error('Swipe page error:', error);
    req.flash('error', 'Error loading matches');
    res.redirect('/dashboard');
  }
});

// Handle swipe action
router.post('/swipe', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const { targetId, action, targetType } = req.body;

    if (!['like', 'pass'].includes(action) || !['project', 'user'].includes(targetType)) {
      return res.status(400).json({ error: 'Invalid action or target type' });
    }

    // Record swipe history
    await SwipeHistory.create({
      user_id: req.user.id,
      target_id: parseInt(targetId),
      target_type: targetType,
      action
    });

    // If it's a like, check for potential matches
    if (action === 'like') {
      let matchCreated = false;

      if (req.user.user_type === 'collaborator' && targetType === 'project') {
        // Collaborator liked a project
        const project = await Project.findById(targetId);
        if (project) {
          const match = await Match.create({
            project_id: project.id,
            collaborator_id: req.user.id,
            idealizer_id: project.idealizer_id
          });
          
          if (match) {
            await Match.updateInterest(match.id, 'collaborator', true);
            matchCreated = true;
          }
        }
      } else if (req.user.user_type === 'idealizer' && targetType === 'user') {
        // Idealizer liked a collaborator - need to check if there are mutual interests
        // This would require more complex logic based on projects
        // For now, we'll just record the interest
      }

      res.json({ 
        success: true, 
        matchCreated,
        message: matchCreated ? 'It\'s a match!' : 'Interest recorded'
      });
    } else {
      res.json({ success: true, message: 'Passed' });
    }
  } catch (error) {
    console.error('Swipe action error:', error);
    res.status(500).json({ error: 'Error processing swipe' });
  }
});

// View matches
router.get('/matches', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const matches = await Match.getUserMatches(req.user.id, req.user.user_type);
    
    res.render('match/matches', {
      title: 'My Matches',
      matches,
      userType: req.user.user_type
    });
  } catch (error) {
    console.error('Matches page error:', error);
    req.flash('error', 'Error loading matches');
    res.redirect('/dashboard');
  }
});

// Respond to match (accept/reject)
router.post('/respond/:matchId', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const { action } = req.body;
    const matchId = req.params.matchId;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check if user is part of this match
    if (match.collaborator_id != req.user.id && match.idealizer_id != req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userType = match.collaborator_id == req.user.id ? 'collaborator' : 'idealizer';
    const interested = action === 'accept';

    await Match.updateInterest(matchId, userType, interested);

    res.json({ 
      success: true, 
      message: action === 'accept' ? 'Match accepted!' : 'Match rejected'
    });
  } catch (error) {
    console.error('Match response error:', error);
    res.status(500).json({ error: 'Error responding to match' });
  }
});

// Get project details for swipe card
router.get('/project/:id', ensureAuthenticated, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectSkills = await Skill.getProjectSkills(project.id);
    
    res.json({
      project,
      skills: projectSkills
    });
  } catch (error) {
    console.error('Project details error:', error);
    res.status(500).json({ error: 'Error loading project details' });
  }
});

// Get user details for swipe card
router.get('/user/:id', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.getWithProfile(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userSkills = await Skill.getUserSkills(user.id);
    
    res.json({
      user,
      skills: userSkills
    });
  } catch (error) {
    console.error('User details error:', error);
    res.status(500).json({ error: 'Error loading user details' });
  }
});

module.exports = router;
