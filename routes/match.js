
const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureProfileComplete } = require('../middleware/auth');
const Project = require('../models/Project');
const User = require('../models/User');
const Match = require('../models/Match');
const SwipeHistory = require('../models/SwipeHistory');
const Skill = require('../models/Skill');

// Página de seleção de projeto para idealizadores
router.get('/select-project', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    // Apenas idealizadores podem acessar
    if (req.user.user_type !== 'idealizer') {
      return res.redirect('/match/swipe');
    }

    const projects = await Project.findByIdealizerId(req.user.id);
    const activeProjects = projects.filter(p => p.status === 'active');

    if (activeProjects.length === 0) {
      req.flash('error', 'Você precisa ter pelo menos um projeto ativo para descobrir colaboradores.');
      return res.redirect('/projects');
    }

    res.render('match/select-project', {
      title: 'Escolha um Projeto',
      projects: activeProjects
    });
  } catch (error) {
    console.error('Project selection error:', error);
    req.flash('error', 'Erro ao carregar projetos');
    res.redirect('/dashboard');
  }
});

// Swipe interface
router.get('/swipe', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    let items = [];
    let swipeType = 'projects';
    let selectedProject = null;

    if (req.user.user_type === 'collaborator') {
      // Colaboradores veem projetos
      items = await Project.getProjectsForMatching(req.user.id);
      swipeType = 'projects';
    } else {
      // Idealizadores precisam selecionar um projeto primeiro
      const projectId = req.query.project_id;
      
      if (!projectId) {
        return res.redirect('/match/select-project');
      }

      // Verificar se o projeto pertence ao usuário
      const project = await Project.findById(projectId);
      if (!project || project.idealizer_id !== req.user.id) {
        req.flash('error', 'Projeto não encontrado ou não autorizado');
        return res.redirect('/match/select-project');
      }

      // Buscar colaboradores não vistos para este projeto
      items = await User.getCollaboratorsForMatching(req.user.id, projectId);
      swipeType = 'collaborators';
      selectedProject = project;
    }

    res.render('match/swipe', {
      title: 'Descobrir',
      items,
      swipeType,
      userType: req.user.user_type,
      selectedProject
    });
  } catch (error) {
    console.error('Swipe page error:', error);
    req.flash('error', 'Erro ao carregar');
    res.redirect('/dashboard');
  }
});

// Handle swipe action
router.post('/swipe', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const { targetId, action, targetType, projectId } = req.body;

    if (!['like', 'pass'].includes(action) || !['project', 'user'].includes(targetType)) {
      return res.status(400).json({ error: 'Ação ou tipo de alvo inválido' });
    }

    // Para idealizadores, projectId é obrigatório quando fazem swipe em usuários
    if (req.user.user_type === 'idealizer' && targetType === 'user' && !projectId) {
      return res.status(400).json({ error: 'ID do projeto é obrigatório' });
    }

    // Registrar histórico de swipe
    await SwipeHistory.create({
      user_id: req.user.id,
      target_id: parseInt(targetId),
      target_type: targetType,
      action,
      project_context_id: projectId ? parseInt(projectId) : null
    });

    let matchResult = { matchCreated: false, message: action === 'like' ? 'Interesse registrado!' : 'Passou' };

    // Se foi like, verificar possível match
    if (action === 'like') {
      if (req.user.user_type === 'collaborator' && targetType === 'project') {
        // Colaborador deu like em projeto
        const project = await Project.findById(targetId);
        if (project) {
          const result = await Match.checkAndCreateMatch(project.id, req.user.id, project.idealizer_id);
          if (result.isNewMatch) {
            matchResult = { matchCreated: true, message: 'É um match! 🎉' };
          }
        }
      } else if (req.user.user_type === 'idealizer' && targetType === 'user') {
        // Idealizador deu like em colaborador através de um projeto
        const result = await Match.checkAndCreateMatch(parseInt(projectId), parseInt(targetId), req.user.id);
        if (result.isNewMatch) {
          matchResult = { matchCreated: true, message: 'É um match! 🎉' };
        }
      }
    }

    res.json({ success: true, ...matchResult });
  } catch (error) {
    console.error('Swipe action error:', error);
    res.status(500).json({ error: 'Erro ao processar ação' });
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
