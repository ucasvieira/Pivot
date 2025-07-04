const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureProfileComplete } = require('../middleware/auth');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const ProjectSkill = require('../models/ProjectSkill');
const SwipeHistory = require('../models/SwipeHistory');

// Middleware para todas as rotas de projetos
router.use(ensureAuthenticated);
router.use(ensureProfileComplete);

// Listar todos os projetos
router.get('/', async (req, res) => {
  try {
    const projects = await Project.getAll(req.user.id);
    
    // Se for colaborador, verificar quais projetos já demonstrou interesse
    let projectInterests = {};
    if (req.user.user_type === 'collaborator') {
    // Aqui você pode implementar a lógica para verificar interesses
    // Por enquanto, deixamos vazio
    }
    
    res.render('projects/list', {
    projects,
    projectInterests,
    user: req.user,
    title: 'Projetos Disponíveis'
    });
  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
    res.status(500).render('error', { 
    message: 'Erro ao carregar projetos',
    error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Meus projetos (apenas para idealizadores)
router.get('/my', async (req, res) => {
  try {
    if (req.user.user_type !== 'idealizer') {
    return res.redirect('/projects');
    }

    const projects = await Project.findByIdealizerId(req.user.id);
    
    res.render('projects/my-projects', {
    projects,
    user: req.user,
    title: 'Meus Projetos'
    });
  } catch (error) {
    console.error('Erro ao carregar meus projetos:', error);
    res.status(500).render('error', { 
    message: 'Erro ao carregar seus projetos',
    error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Formulário de criação de projeto
router.get('/create', async (req, res) => {
  try {
    if (req.user.user_type !== 'idealizer') {
    req.flash('error', 'Apenas idealizadores podem criar projetos');
    return res.redirect('/projects');
    }

    const skills = await Skill.getAll();
    
    res.render('projects/create', {
    skills,
    user: req.user,
    title: 'Criar Projeto'
    });
  } catch (error) {
    console.error('Erro ao carregar formulário de criação:', error);
    res.status(500).render('error', { 
    message: 'Erro ao carregar formulário',
    error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Criar projeto
router.post('/create', async (req, res) => {
  try {
    if (req.user.user_type !== 'idealizer') {
    req.flash('error', 'Apenas idealizadores podem criar projetos');
    return res.redirect('/projects');
    }

    const { title, description, objectives, timeline, location_preference, required_skills } = req.body;

    // Validações básicas
    if (!title || !description || !objectives || !timeline || !location_preference) {
    req.flash('error', 'Todos os campos obrigatórios devem ser preenchidos');
    return res.redirect('/projects/create');
    }

    if (description.length < 20) {
    req.flash('error', 'A descrição deve ter pelo menos 20 caracteres');
    return res.redirect('/projects/create');
    }

    // Criar projeto
    const projectData = {
    idealizer_id: req.user.id,
    title: title.trim(),
    description: description.trim(),
    objectives: objectives.trim(),
    timeline,
    location_preference: location_preference.trim()
    };

    const project = await Project.create(projectData);

    // Adicionar habilidades requeridas se selecionadas
    if (required_skills && Array.isArray(required_skills)) {
    for (const skillId of required_skills) {
    await ProjectSkill.create({
    project_id: project.id,
    skill_id: parseInt(skillId),
    required_level: 'intermediate' // Valor padrão
    });
    }
    } else if (required_skills) {
    // Se for apenas uma skill (não array)
    await ProjectSkill.create({
    project_id: project.id,
    skill_id: parseInt(required_skills),
    required_level: 'intermediate'
    });
    }

    req.flash('success', 'Projeto criado com sucesso!');
    res.redirect(`/projects/view/${project.id}`);

  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    req.flash('error', 'Erro ao criar projeto. Tente novamente.');
    res.redirect('/projects/create');
  }
});


// Visualizar projeto específico
router.get('/view/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);

    if (!project) {
      req.flash('error', 'Projeto não encontrado');
      return res.redirect('/projects');
    }

    // Buscar habilidades do projeto
    const projectSkills = await ProjectSkill.getByProjectId(projectId);

    // Verificar se o usuário já demonstrou interesse (se for colaborador)
    let hasInterest = false;
    if (req.user.user_type === 'collaborator') {
      // Implementar verificação de interesse
      // For now, let's assume a placeholder function
      hasInterest = await SwipeHistory.hasUserSwipedTarget(req.user.id, projectId, 'project', null);
    }

    // Verificar se o usuário é o dono do projeto
    const isOwner = project.idealizer_id === req.user.id;

    res.render('projects/view', {
      project,
      projectSkills,
      hasInterest,
      user: req.user,
      title: project.title,
      isOwner,
      hasAlreadyShownInterest: hasInterest // Add this line to pass hasAlreadyShownInterest to the template
    });

  } catch (error) {
    console.error('Erro ao visualizar projeto:', error);
    res.status(500).render('error', { 
      message: 'Erro ao carregar projeto',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Formulário de edição de projeto
router.get('/edit/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);

    if (!project) {
    req.flash('error', 'Projeto não encontrado');
    return res.redirect('/projects/my');
    }

    // Verificar se o usuário é o dono do projeto
    if (project.idealizer_id !== req.user.id) {
    req.flash('error', 'Você não tem permissão para editar este projeto');
    return res.redirect('/projects/my');
    }

    const skills = await Skill.getAll();
    const projectSkills = await ProjectSkill.getByProjectId(projectId);
    const selectedSkillIds = projectSkills.map(ps => ps.skill_id);

    res.render('projects/edit', {
    project,
    skills,
    selectedSkillIds,
    user: req.user,
    title: 'Editar Projeto'
    });

  } catch (error) {
    console.error('Erro ao carregar formulário de edição:', error);
    res.status(500).render('error', { 
    message: 'Erro ao carregar formulário',
    error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Atualizar projeto
router.post('/edit/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);

    if (!project) {
    req.flash('error', 'Projeto não encontrado');
    return res.redirect('/projects/my');
    }

    // Verificar se o usuário é o dono do projeto
    if (project.idealizer_id !== req.user.id) {
    req.flash('error', 'Você não tem permissão para editar este projeto');
    return res.redirect('/projects/my');
    }

    const { title, description, objectives, timeline, location_preference, status, required_skills } = req.body;

    // Validações básicas
    if (!title || !description || !objectives || !timeline || !location_preference) {
    req.flash('error', 'Todos os campos obrigatórios devem ser preenchidos');
    return res.redirect(`/projects/edit/${projectId}`);
    }

    // Atualizar projeto
    const projectData = {
    title: title.trim(),
    description: description.trim(),
    objectives: objectives.trim(),
    timeline,
    location_preference: location_preference.trim(),
    status: status || 'active'
    };

    await Project.update(projectId, projectData);

    // Atualizar habilidades requeridas
    await ProjectSkill.deleteByProjectId(projectId);
    
    if (required_skills && Array.isArray(required_skills)) {
    for (const skillId of required_skills) {
    await ProjectSkill.create({
    project_id: projectId,
    skill_id: parseInt(skillId),
    required_level: 'intermediate'
    });
    }
    } else if (required_skills) {
    await ProjectSkill.create({
    project_id: projectId,
    skill_id: parseInt(required_skills),
    required_level: 'intermediate'
    });
    }

    req.flash('success', 'Projeto atualizado com sucesso!');
    res.redirect(`/projects/view/${projectId}`);

  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    req.flash('error', 'Erro ao atualizar projeto. Tente novamente.');
    res.redirect(`/projects/edit/${req.params.id}`);
  }
});

// Excluir projeto
router.post('/delete/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);

    if (!project) {
    req.flash('error', 'Projeto não encontrado');
    return res.redirect('/projects/my');
    }

    // Verificar se o usuário é o dono do projeto
    if (project.idealizer_id !== req.user.id) {
    req.flash('error', 'Você não tem permissão para excluir este projeto');
    return res.redirect('/projects/my');
    }

    await Project.delete(projectId);

    req.flash('success', 'Projeto excluído com sucesso!');
    res.redirect('/projects/my');

  } catch (error) {
    console.error('Erro ao excluir projeto:', error);
    req.flash('error', 'Erro ao excluir projeto. Tente novamente.');
    res.redirect('/projects/my');
  }
});

module.exports = router;