
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { ensureAuthenticated, ensureProfileComplete, ensureUserType } = require('../middleware/auth');
const Project = require('../models/Project');
const Skill = require('../models/Skill');

// List all projects
router.get('/', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const projects = await Project.getAll(req.user.id);
    
    // Se for colaborador, verificar quais projetos já têm interesse registrado
    let projectInterests = {};
    if (req.user.user_type === 'collaborator') {
      const SwipeHistory = require('../models/SwipeHistory');
      for (const project of projects) {
        projectInterests[project.id] = await SwipeHistory.hasUserSwipedTarget(
          req.user.id, 
          project.id, 
          'project'
        );
      }
    }

    res.render('projects/list', {
      title: 'All Projects',
      projects,
      projectInterests
    });
  } catch (error) {
    console.error('Projects list error:', error);
    req.flash('error', 'Error loading projects');
    res.redirect('/dashboard');
  }
});

// My projects (for idealizers)
router.get('/my', ensureAuthenticated, ensureProfileComplete, ensureUserType('idealizer'), async (req, res) => {
  try {
    const projects = await Project.findByIdealizerId(req.user.id);
    res.render('projects/my-projects', {
      title: 'My Projects',
      projects
    });
  } catch (error) {
    console.error('My projects error:', error);
    req.flash('error', 'Error loading your projects');
    res.redirect('/dashboard');
  }
});

// Create project page
router.get('/create', ensureAuthenticated, ensureProfileComplete, ensureUserType('idealizer'), async (req, res) => {
  try {
    const skills = await Skill.getAll();
    res.render('projects/create', {
      title: 'Create New Project',
      skills
    });
  } catch (error) {
    console.error('Create project page error:', error);
    req.flash('error', 'Error loading create project page');
    res.redirect('/dashboard');
  }
});

// Create project handler
router.post('/create', ensureAuthenticated, ensureProfileComplete, ensureUserType('idealizer'), [
  body('title').trim().isLength({ min: 3 }),
  body('description').trim().isLength({ min: 20 }),
  body('objectives').trim().isLength({ min: 10 }),
  body('timeline').trim().isLength({ min: 1 }),
  body('location_preference').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Please fill in all required fields correctly');
      return res.redirect('/projects/create');
    }

    const {
      title, description, objectives, timeline, location_preference,
      required_skills
    } = req.body;

    // Create project
    const project = await Project.create({
      idealizer_id: req.user.id,
      title,
      description,
      objectives,
      timeline,
      location_preference
    });

    // Add required skills
    if (required_skills) {
      const skillsArray = Array.isArray(required_skills) ? required_skills : [required_skills];
      const skillsData = skillsArray.map(skillId => ({
        skill_id: parseInt(skillId),
        required_level: 'intermediate' // Default level
      }));
      await Skill.updateProjectSkills(project.id, skillsData);
    }

    req.flash('success', 'Project created successfully!');
    res.redirect('/projects/my');
  } catch (error) {
    console.error('Create project error:', error);
    req.flash('error', 'Error creating project');
    res.redirect('/projects/create');
  }
});

// View project
router.get('/view/:id', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      req.flash('error', 'Project not found');
      return res.redirect('/projects');
    }

    const projectSkills = await Skill.getProjectSkills(project.id);
    
    // Verificar se o colaborador já demonstrou interesse neste projeto
    let hasAlreadyShownInterest = false;
    if (req.user.user_type === 'collaborator') {
      const SwipeHistory = require('../models/SwipeHistory');
      hasAlreadyShownInterest = await SwipeHistory.hasUserSwipedTarget(
        req.user.id, 
        project.id, 
        'project'
      );
    }

    res.render('projects/view', {
      title: project.title,
      project,
      projectSkills,
      isOwner: project.idealizer_id == req.user.id,
      hasAlreadyShownInterest
    });
  } catch (error) {
    console.error('Project view error:', error);
    req.flash('error', 'Error loading project');
    res.redirect('/projects');
  }
});

// Edit project page
router.get('/edit/:id', ensureAuthenticated, ensureProfileComplete, ensureUserType('idealizer'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project || project.idealizer_id != req.user.id) {
      req.flash('error', 'Project not found or access denied');
      return res.redirect('/projects/my');
    }

    const skills = await Skill.getAll();
    const projectSkills = await Skill.getProjectSkills(project.id);

    res.render('projects/edit', {
      title: 'Edit Project',
      project,
      skills,
      projectSkills
    });
  } catch (error) {
    console.error('Edit project page error:', error);
    req.flash('error', 'Error loading project');
    res.redirect('/projects/my');
  }
});

// Edit project handler
router.post('/edit/:id', ensureAuthenticated, ensureProfileComplete, ensureUserType('idealizer'), [
  body('title').trim().isLength({ min: 3 }),
  body('description').trim().isLength({ min: 20 }),
  body('objectives').trim().isLength({ min: 10 }),
  body('timeline').trim().isLength({ min: 1 }),
  body('location_preference').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project || project.idealizer_id != req.user.id) {
      req.flash('error', 'Project not found or access denied');
      return res.redirect('/projects/my');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Please fill in all required fields correctly');
      return res.redirect(`/projects/edit/${req.params.id}`);
    }

    const {
      title, description, objectives, timeline, location_preference,
      status, required_skills
    } = req.body;

    // Update project
    await Project.update(req.params.id, {
      title,
      description,
      objectives,
      timeline,
      location_preference,
      status: status || 'active'
    });

    // Update required skills
    if (required_skills) {
      const skillsArray = Array.isArray(required_skills) ? required_skills : [required_skills];
      const skillsData = skillsArray.map(skillId => ({
        skill_id: parseInt(skillId),
        required_level: 'intermediate' // Default level
      }));
      await Skill.updateProjectSkills(req.params.id, skillsData);
    } else {
      await Skill.updateProjectSkills(req.params.id, []);
    }

    req.flash('success', 'Project updated successfully!');
    res.redirect('/projects/my');
  } catch (error) {
    console.error('Update project error:', error);
    req.flash('error', 'Error updating project');
    res.redirect(`/projects/edit/${req.params.id}`);
  }
});

// Delete project
router.post('/delete/:id', ensureAuthenticated, ensureProfileComplete, ensureUserType('idealizer'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project || project.idealizer_id != req.user.id) {
      req.flash('error', 'Project not found or access denied');
      return res.redirect('/projects/my');
    }

    await Project.delete(req.params.id);
    req.flash('success', 'Project deleted successfully!');
    res.redirect('/projects/my');
  } catch (error) {
    console.error('Delete project error:', error);
    req.flash('error', 'Error deleting project');
    res.redirect('/projects/my');
  }
});

module.exports = router;
