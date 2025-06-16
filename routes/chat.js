const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureProfileComplete } = require('../middleware/auth');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const db = require('../config/database'); 

// Chat list page
router.get('/', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const conversations = await Conversation.getUserConversations(req.user.id);
    
    res.render('chat/list', {
      title: 'Messages',
      conversations
    });
  } catch (error) {
    console.error('Chat list error:', error);
    req.flash('error', 'Error loading conversations');
    res.redirect('/dashboard');
  }
});

// Individual chat page - ajustado para sua view existente
router.get('/conversation/:conversationId', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Converter para número
    const numericConversationId = parseInt(conversationId);
    
    // Validar se conversationId é um número válido
    if (!numericConversationId || isNaN(numericConversationId)) {
      req.flash('error', 'ID da conversa inválido');
      return res.redirect('/chat');
    }
    
    console.log(`Carregando conversa ${numericConversationId} para usuário ${req.user.id}`);
    
    // Verificar se o usuário tem acesso a esta conversa
    const conversation = await Conversation.findById(numericConversationId);
    if (!conversation) {
      req.flash('error', 'Conversa não encontrada');
      return res.redirect('/chat');
    }
    
    // Verificar se o usuário faz parte desta conversa
    const match = await Match.findById(conversation.match_id);
    if (!match || (match.collaborator_id !== req.user.id && match.idealizer_id !== req.user.id)) {
      req.flash('error', 'Acesso negado a esta conversa');
      return res.redirect('/chat');
    }
    
    // Buscar mensagens iniciais
    const messages = await Message.getByConversationId(numericConversationId, 50);
    
    // Marcar mensagens como lidas
    await Message.markAsRead(numericConversationId, req.user.id);
    
    // Determinar o ID do outro usuário (para usar na view)
    const otherUserId = match.collaborator_id === req.user.id ? 
      match.idealizer_id : match.collaborator_id;
    
    // Renderizar a página do chat (usando 'user' como sua view espera)
    res.render('chat/conversation', {
      title: `Chat - ${match.project_title}`,
      conversation,
      messages,
      match,
      otherUserId, // Adicionado para os links na view
      user: req.user // Sua view usa 'user' em vez de 'currentUser'
    });
    
  } catch (error) {
    console.error('Conversation error:', error);
    req.flash('error', 'Erro ao carregar conversa');
    res.redirect('/chat');
  }
});

// Send message API
router.post('/send', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    
    console.log(`=== NOVA REQUISIÇÃO DE MENSAGEM ===`);
    console.log(`Usuário: ${req.user.id}`);
    console.log(`Conversa: ${conversationId}`);
    console.log(`Mensagem: "${message}"`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    if (!message || !message.trim()) {
      console.log('Mensagem vazia rejeitada');
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const numericConversationId = parseInt(conversationId);
    
    // Verificar se a mensagem já existe (proteção contra duplicação)
    const recentMessages = await db.query(
      `SELECT * FROM messages 
       WHERE conversation_id = ? 
       AND sender_id = ? 
       AND message = ? 
       AND created_at > DATE_SUB(NOW(), INTERVAL 2 SECOND)`, // Reduzido para 2 segundos
      [numericConversationId, req.user.id, message.trim()]
    );
    
    if (recentMessages.rows.length > 0) {
      console.log('Mensagem duplicada detectada, rejeitando');
      return res.status(409).json({ 
        error: 'Duplicate message detected',
        message: recentMessages.rows[0]
      });
    }
    
    // Verify user has access to this conversation
    const conversation = await Conversation.findById(numericConversationId);
    if (!conversation) {
      console.log('Conversa não encontrada');
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const match = await Match.findById(conversation.match_id);
    if (!match || (match.collaborator_id != req.user.id && match.idealizer_id != req.user.id)) {
      console.log('Acesso negado à conversa');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create message
    console.log('Criando mensagem no banco...');
    const newMessage = await Message.create({
      conversation_id: numericConversationId,
      sender_id: req.user.id,
      message: message.trim()
    });

    console.log('Mensagem criada com sucesso:', newMessage);

    // EMITIR via Socket.IO para outros usuários
    if (req.io) {
      console.log('Emitindo via Socket.IO para outros usuários na conversa');
      req.io.to(`conversation_${numericConversationId}`).emit('new-message', {
        senderId: req.user.id,
        message: newMessage.message,
        conversationId: numericConversationId,
        created_at: newMessage.created_at,
        senderName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email
      });
    }

    res.json({
      success: true,
      message: newMessage
    });
    
    console.log(`=== FIM DA REQUISIÇÃO ===\n`);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Get messages for a conversation
router.get('/messages/:conversationId', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);

    // Verify user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const match = await Match.findById(conversation.match_id);
    if (!match || (match.collaborator_id != req.user.id && match.idealizer_id != req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.getByConversationId(conversationId);
    
    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Error loading messages' });
  }
});

module.exports = router;