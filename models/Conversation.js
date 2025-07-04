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
    // Usar view para buscar conversas com última mensagem
    const query = `
      SELECT * FROM vw_conversations_with_last_message
      WHERE (collaborator_id = ? OR idealizer_id = ?)
      ORDER BY last_message_time DESC, created_at DESC
    `;

    const result = await db.query(query, [userId, userId]);
    return result.rows;
  }
}

module.exports = Conversation;