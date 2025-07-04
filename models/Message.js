const db = require('../config/database');

class Message {
  static async create(messageData) {
    const { conversation_id, sender_id, message } = messageData;

    const query = `
      INSERT INTO messages (conversation_id, sender_id, message)
      VALUES (?, ?, ?)
    `;

    const result = await db.query(query, [conversation_id, sender_id, message]);
    return { id: result.insertId, ...messageData, created_at: new Date() };
  }

  static async findById(id) {
    const query = `
      SELECT m.*, u.email as sender_email, up.first_name, up.last_name, up.profile_picture
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE m.id = ?
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async getByConversationId(conversationId, limit = 50) {
    try {
      // Usar LIMIT diretamente na string SQL em vez de placeholder
      const query = `
        SELECT m.*, u.email as sender_email, up.first_name, up.last_name, up.profile_picture
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at ASC
        LIMIT ${parseInt(limit)}
      `;

      const result = await db.query(query, [conversationId]);
      return result.rows;
    } catch (error) {
      console.error('Erro na query de mensagens:', error);
      throw error;
    }
  }

  static async markAsRead(conversationId, userId) {
    const query = `
      UPDATE messages 
      SET is_read = true 
      WHERE conversation_id = ? AND sender_id != ? AND is_read = false
    `;
    
    await db.query(query, [conversationId, userId]);
  }

  static async getUnreadCount(userId) {
    const query = `
      SELECT COUNT(*) as unread_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN matches ma ON c.match_id = ma.id
      WHERE (ma.collaborator_id = ? OR ma.idealizer_id = ?)
      AND m.sender_id != ?
      AND m.is_read = false
    `;

    const result = await db.query(query, [userId, userId, userId]);
    return result.rows[0].unread_count;
  }

  static async getLastMessage(conversationId) {
    const query = `
      SELECT m.*, u.email as sender_email, up.first_name, up.last_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [conversationId]);
    return result.rows[0];
  }

  static async getConversationMessages(conversationId, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;
      
      // Usar LIMIT e OFFSET diretamente na string SQL
      const query = `
        SELECT m.*, u.email as sender_email, up.first_name, up.last_name, up.profile_picture
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;

      const result = await db.query(query, [conversationId]);
      
      // Reverter a ordem para mostrar mensagens mais antigas primeiro
      return result.rows.reverse();
    } catch (error) {
      console.error('Erro ao buscar mensagens paginadas:', error);
      throw error;
    }
  }

  static async delete(id) {
    const query = 'DELETE FROM messages WHERE id = ?';
    await db.query(query, [id]);
  }
}

module.exports = Message;