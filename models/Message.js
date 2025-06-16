const db = require('../config/database');

class Message {
  static async create(messageData) {
    const { conversation_id, sender_id, message } = messageData;
    
    const query = `
      INSERT INTO messages (conversation_id, sender_id, message, created_at)
      VALUES (?, ?, ?, NOW())
    `;
    
    const result = await db.query(query, [
      parseInt(conversation_id), 
      parseInt(sender_id), 
      message
    ]);
    return { id: result.insertId, ...messageData, created_at: new Date() };
  }

  static async getByConversationId(conversationId, limit = 50) {
    const numericConversationId = parseInt(conversationId);
    let numericLimit = parseInt(limit);
    
    if (!numericConversationId || isNaN(numericConversationId)) {
      throw new Error('Conversation ID deve ser um número válido');
    }
    
    if (isNaN(numericLimit) || numericLimit <= 0) {
      numericLimit = 50;
    }
    
    console.log(`Buscando mensagens - Conversation ID: ${numericConversationId}, Limit: ${numericLimit}`);
    
    try {
      // Query com LIMIT hardcoded (funcionou!)
      const query = `
        SELECT m.*, u.email as sender_email, up.first_name, up.last_name, up.profile_picture
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE m.conversation_id = ${numericConversationId}
        ORDER BY m.created_at ASC
        LIMIT ${numericLimit}
      `;
      
      const result = await db.query(query);
      return result.rows;
      
    } catch (error) {
      console.error('Erro na query de mensagens:', error);
      
      // Fallback: query mais simples
      const fallbackQuery = `
        SELECT m.*, u.email as sender_email, up.first_name, up.last_name, up.profile_picture
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at ASC
      `;
      
      const fallbackResult = await db.query(fallbackQuery, [numericConversationId]);
      
      // Aplicar limit manualmente se necessário
      return fallbackResult.rows.slice(0, numericLimit);
    }
  }

  static async getLatestByConversationId(conversationId) {
    const numericConversationId = parseInt(conversationId);
    
    if (!numericConversationId || isNaN(numericConversationId)) {
      return null;
    }
    
    const query = `
      SELECT m.*, u.email as sender_email, up.first_name, up.last_name, up.profile_picture
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
      LIMIT 1
    `;
    
    const result = await db.query(query, [numericConversationId]);
    return result.rows[0];
  }

  // CORRIGIDO: Removidos métodos que usam is_read
  static async markAsRead(conversationId, userId) {
    // Funcionalidade desabilitada - coluna is_read não existe
    console.log(`Marcando mensagens como lidas (funcionalidade desabilitada): conversa ${conversationId}, usuário ${userId}`);
    return;
  }
  
  static async getUnreadCount(conversationId, userId) {
    // Funcionalidade desabilitada - coluna is_read não existe
    console.log(`Contando mensagens não lidas (funcionalidade desabilitada): conversa ${conversationId}, usuário ${userId}`);
    return 0;
  }
}

module.exports = Message;