
const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureProfileComplete } = require('../middleware/auth');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

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

// Individual chat page
router.get('/conversation/:matchId', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const matchId = req.params.matchId;
    
    // Verify user is part of this match
    const match = await Match.findById(matchId);
    if (!match || (match.collaborator_id != req.user.id && match.idealizer_id != req.user.id)) {
      req.flash('error', 'Conversation not found or access denied');
      return res.redirect('/chat');
    }

    // Check if match is accepted
    if (match.status !== 'accepted') {
      req.flash('error', 'You can only chat with accepted matches');
      return res.redirect('/match/matches');
    }

    // Get or create conversation
    const conversation = await Conversation.getOrCreate(matchId);
    
    // Get messages
    const messages = await Message.getByConversationId(conversation.id);
    
    // Determine other user
    const otherUserId = match.collaborator_id == req.user.id ? match.idealizer_id : match.collaborator_id;
    const otherUserType = match.collaborator_id == req.user.id ? 'idealizer' : 'collaborator';

    res.render('chat/conversation', {
      title: `Chat - ${match.project_title}`,
      conversation,
      messages,
      match,
      otherUserId,
      otherUserType
    });
  } catch (error) {
    console.error('Conversation error:', error);
    req.flash('error', 'Error loading conversation');
    res.redirect('/chat');
  }
});

// Send message API
router.post('/send', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // Verify user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const match = await Match.findById(conversation.match_id);
    if (!match || (match.collaborator_id != req.user.id && match.idealizer_id != req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create message
    const newMessage = await Message.create({
      conversation_id: conversationId,
      sender_id: req.user.id,
      message: message.trim()
    });

    res.json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Get messages for a conversation
router.get('/messages/:conversationId', ensureAuthenticated, ensureProfileComplete, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

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
