const db = require('../config/database');

class Match {
  static async create(matchData) {
    const { project_id, collaborator_id, idealizer_id } = matchData;

    // Verificar se já existe usando a view
    const existingQuery = 'SELECT * FROM vw_matches_complete WHERE project_id = ? AND collaborator_id = ?';
    const existing = await db.query(existingQuery, [project_id, collaborator_id]);
    
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const query = `
      INSERT INTO matches (project_id, collaborator_id, idealizer_id, collaborator_interested, idealizer_interested, status)
      VALUES (?, ?, ?, false, false, 'pending')
    `;

    const result = await db.query(query, [project_id, collaborator_id, idealizer_id]);
    return { id: result.insertId, ...matchData, collaborator_interested: false, idealizer_interested: false, status: 'pending' };
  }

  static async checkAndCreateMatch(projectId, collaboratorId, idealizerId) {
    try {
      // Usar stored procedure para verificar e criar match
      console.log('🔍 Calling stored procedure for match creation...');
      
      const connection = await db.pool.getConnection();
      
      try {
        await connection.execute('CALL sp_check_and_create_match(?, ?, ?, @match_id, @is_new_match)', 
          [projectId, collaboratorId, idealizerId]);
        
        // Obter resultados
        const [result] = await connection.execute('SELECT @match_id as match_id, @is_new_match as is_new_match');
        const { match_id, is_new_match } = result[0];
        
        if (match_id) {
          const match = await this.findById(match_id);
          return { match, isNewMatch: Boolean(is_new_match) };
        }
        
        return { match: null, isNewMatch: false };
        
      } finally {
        connection.release();
      }
      
    } catch (error) {
      console.error('❌ Error calling stored procedure for match creation:', error);
      
      // Fallback para lógica direta
      const existingMatch = await this.findByUserAndProject(collaboratorId, projectId);
      return { match: existingMatch, isNewMatch: false };
    }
  }

  static async findById(id) {
    // Usar view para buscar match completo
    const query = `SELECT * FROM vw_matches_complete WHERE id = ?`;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByUserAndProject(collaboratorId, projectId) {
    const query = 'SELECT * FROM matches WHERE collaborator_id = ? AND project_id = ?';
    const result = await db.query(query, [collaboratorId, projectId]);
    return result.rows[0];
  }

  static async updateInterest(matchId, userType, interested) {
    try {
      // Usar stored procedure para atualizar interesse
      console.log('🔍 Calling stored procedure for match interest update...');
      
      const connection = await db.pool.getConnection();
      
      try {
        await connection.execute('CALL sp_update_match_interest(?, ?, ?, @conversation_id)', 
          [matchId, userType, Boolean(interested)]);
        
        // Obter ID da conversa se foi criada
        const [result] = await connection.execute('SELECT @conversation_id as conversation_id');
        const conversationId = result[0].conversation_id;
        
        // Buscar match atualizado
        const match = await this.findById(matchId);
        
        if (conversationId) {
          console.log(`✅ Conversa criada com ID: ${conversationId} para match ${matchId}`);
        }
        
        return match;
        
      } finally {
        connection.release();
      }
      
    } catch (error) {
      console.error('❌ Error calling stored procedure for match interest:', error);
      
      // Fallback para query direta
      const userIdField = userType === 'collaborator' ? 'collaborator_interested' : 'idealizer_interested';
      const query = `UPDATE matches SET ${userIdField} = ? WHERE id = ?`;
      await db.query(query, [Boolean(interested), matchId]);
      
      return await this.findById(matchId);
    }
  }

  static async getUserMatches(userId, userType) {
    const isCollaborator = userType === 'collaborator';
    const userIdField = isCollaborator ? 'collaborator_id' : 'idealizer_id';

    // Usar view para buscar matches
    const query = `
      SELECT * FROM vw_matches_complete 
      WHERE ${userIdField} = ?
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async getAcceptedMatches(userId) {
    // Usar view para buscar matches aceitos
    const query = `
      SELECT mc.*, c.id as conversation_id
      FROM vw_matches_complete mc
      LEFT JOIN conversations c ON c.match_id = mc.id
      WHERE (mc.collaborator_id = ? OR mc.idealizer_id = ?) 
      AND mc.status = 'accepted'
      ORDER BY mc.created_at DESC
    `;

    const result = await db.query(query, [userId, userId]);
    return result.rows;
  }

  static async getPendingMatches(userId, userType) {
    const isCollaborator = userType === 'collaborator';
    const userIdField = isCollaborator ? 'collaborator_id' : 'idealizer_id';
    const userInterestedField = isCollaborator ? 'collaborator_interested' : 'idealizer_interested';

    const query = `
      SELECT * FROM vw_matches_complete
      WHERE ${userIdField} = ?
      AND status = 'pending'
      AND ${userInterestedField} = false
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async getMatchStats(userId) {
    try {
      // Usar functions para obter estatísticas
      const query = `
        SELECT 
          fn_count_user_matches(?, NULL) as total_matches,
          fn_count_user_matches(?, 'accepted') as accepted_matches,
          fn_count_user_matches(?, 'pending') as pending_matches
      `;

      const result = await db.query(query, [userId, userId, userId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error calling functions for match stats:', error);
      
      // Fallback para queries diretas
      const totalQuery = 'SELECT COUNT(*) as total_matches FROM matches WHERE collaborator_id = ? OR idealizer_id = ?';
      const acceptedQuery = 'SELECT COUNT(*) as accepted_matches FROM matches WHERE (collaborator_id = ? OR idealizer_id = ?) AND status = "accepted"';
      const pendingQuery = 'SELECT COUNT(*) as pending_matches FROM matches WHERE (collaborator_id = ? OR idealizer_id = ?) AND status = "pending"';
      
      const [total, accepted, pending] = await Promise.all([
        db.query(totalQuery, [userId, userId]),
        db.query(acceptedQuery, [userId, userId]),
        db.query(pendingQuery, [userId, userId])
      ]);
      
      return {
        total_matches: total.rows[0].total_matches,
        accepted_matches: accepted.rows[0].accepted_matches,
        pending_matches: pending.rows[0].pending_matches
      };
    }
  }
}

module.exports = Match;