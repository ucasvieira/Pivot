const db = require('../config/database');

class Conversation {
  static async create(matchId) {
    // Verificar se já existe uma conversa para este match
    const existingQuery = 'SELECT * FROM conversations WHERE match_id = ?';
    const existing = await db.query(existingQuery, [matchId]);
    
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const query = 'INSERT INTO conversations (match_id) VALUES (?)';
    const result = await db.query(query, [matchId]);
    
    return { 
      id: result.insertId, 
      match_id: matchId, 
      created_at: new Date() 
    };
  }

  static async findById(id) {
    const query = 'SELECT * FROM conversations WHERE id = ?';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByMatchId(matchId) {
    const query = 'SELECT * FROM conversations WHERE match_id = ?';
    const result = await db.query(query, [matchId]);
    return result.rows[0];
  }

  static async getUserConversations(userId) {
    const query = `
      SELECT c.*, m.project_id, p.title as project_title,
             u1.id as collaborator_id, up1.first_name as collaborator_first_name,
             up1.last_name as collaborator_last_name, up1.profile_picture as collaborator_picture,
             u2.id as idealizer_id, up2.first_name as idealizer_first_name,
             up2.last_name as idealizer_last_name, up2.profile_picture as idealizer_picture,
             (SELECT msg.message FROM messages msg WHERE msg.conversation_id = c.id ORDER BY msg.created_at DESC LIMIT 1) as last_message,  
             (SELECT msg.created_at FROM messages msg WHERE msg.conversation_id = c.id ORDER BY msg.created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      JOIN matches m ON c.match_id = m.id
      JOIN projects p ON m.project_id = p.id
      JOIN users u1 ON m.collaborator_id = u1.id
      JOIN users u2 ON m.idealizer_id = u2.id
      LEFT JOIN user_profiles up1 ON u1.id = up1.user_id
      LEFT JOIN user_profiles up2 ON u2.id = up2.user_id
      WHERE (m.collaborator_id = ? OR m.idealizer_id = ?) AND m.status = 'accepted'
      ORDER BY last_message_time DESC, c.created_at DESC
    `;

    const result = await db.query(query, [userId, userId]);
    return result.rows;
  }
}

module.exports = Conversation;