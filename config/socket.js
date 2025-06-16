
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join conversation room
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation-${conversationId}`);
      console.log(`User joined conversation: ${conversationId}`);
    });

    // Handle new message
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, senderId, message } = data;
        
        // Save message to database
        const newMessage = await Message.create({
          conversation_id: conversationId,
          sender_id: senderId,
          message: message
        });

        // Emit message to all users in the conversation
        io.to(`conversation-${conversationId}`).emit('new-message', {
          id: newMessage.id,
          message: newMessage.message,
          sender_id: newMessage.sender_id,
          created_at: newMessage.created_at
        });
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message-error', 'Failed to send message');
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      socket.to(`conversation-${data.conversationId}`).emit('user-typing', {
        userId: data.userId,
        isTyping: data.isTyping
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
