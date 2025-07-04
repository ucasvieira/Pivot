const db = require('../config/database');

class SwipeHistory {
  static async create(swipeData) {
    const { user_id, target_id, target_type, action, project_context_id = null } = swipeData;

    try {
      // Usar stored procedure para criar swipe
      console.log('🔍 Calling stored procedure for swipe creation...');
      
      const connection = await db.pool.getConnection();
      
      try {
        // Chamar a stored procedure
        await connection.execute('CALL sp_create_swipe(?, ?, ?, ?, ?, @swipe_id)', 
          [user_id, target_id, target_type, action, project_context_id]);
        
        // Obter o ID do swipe criado
        const [result] = await connection.execute('SELECT @swipe_id as swipe_id');
        const swipeId = result[0].swipe_id;
        
        console.log(`✅ Swipe created with ID: ${swipeId}`);
        return { id: swipeId, ...swipeData };
        
      } finally {
        connection.release();
      }
      
    } catch (error) {
      console.error('❌ Error calling stored procedure, falling back to direct query:', error);
      
      // Fallback para query direta
      const query = `
        INSERT INTO swipe_history (user_id, target_id, target_type, action, project_context_id)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          action = VALUES(action), 
          created_at = CURRENT_TIMESTAMP
      `;
      
      const result = await db.query(query, [user_id, target_id, target_type, action, project_context_id]);
      return { id: result.insertId, ...swipeData };
    }
  }

  static async hasUserSwipedTarget(userId, targetId, targetType, projectContextId = null) {
    try {
      // Usar function para verificar se usuário já deu swipe
      const query = `SELECT fn_has_user_swiped(?, ?, ?, ?) as has_swiped`;
      const result = await db.query(query, [userId, targetId, targetType, projectContextId]);
      return Boolean(result.rows[0].has_swiped);
    } catch (error) {
      console.error('❌ Error calling function, falling back to direct query:', error);
      
      // Fallback para query direta
      const query = `
        SELECT COUNT(*) as count
        FROM swipe_history 
        WHERE user_id = ? 
        AND target_id = ? 
        AND target_type = ?
        AND (project_context_id = ? OR (project_context_id IS NULL AND ? IS NULL))
      `;
      
      const result = await db.query(query, [userId, targetId, targetType, projectContextId, projectContextId]);
      return result.rows[0].count > 0;
    }
  }

  static async getSwipeAction(userId, targetId, targetType, projectContextId = null) {
    try {
      // Usar function para obter ação do swipe
      const query = `SELECT fn_get_swipe_action(?, ?, ?, ?) as action`;
      const result = await db.query(query, [userId, targetId, targetType, projectContextId]);
      return result.rows[0]?.action || null;
    } catch (error) {
      console.error('❌ Error calling function, falling back to direct query:', error);
      
      // Fallback para query direta
      const query = `
        SELECT action
        FROM swipe_history 
        WHERE user_id = ? 
        AND target_id = ? 
        AND target_type = ?
        AND (project_context_id = ? OR (project_context_id IS NULL AND ? IS NULL))
        LIMIT 1
      `;
      
      const result = await db.query(query, [userId, targetId, targetType, projectContextId, projectContextId]);
      return result.rows[0]?.action || null;
    }
  }
}

module.exports = SwipeHistory;