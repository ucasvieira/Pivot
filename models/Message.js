const db = require('../config/database');

class Message {
  static async create(messageData) {
    const { conversation_id, sender_id, message } = messageData;

    const query = `
      INSERT INTO messages (conversation_id, sender_id, message)
      VALUES (?, ?, ?)
    `;

    const result = await db.query(query, [conversation_id, sender_id, message]);
    return { id: result.insertId, ...messageData };
  }

  static async getByConversationId(conversationId, limit = 50) {
    const query = `
      SELECT m.*, u.email as sender_email, up.first_name, up.last_name, up.profile_picture
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `;

    const result = await db.query(query, [conversationId, limit]);
    return result.rows.reverse(); // Return in chronological order
  }
}

module.exports = Message;