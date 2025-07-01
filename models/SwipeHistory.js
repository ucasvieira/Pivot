const db = require('../config/database');

class SwipeHistory {
  static async create(swipeData) {
    const { user_id, target_id, target_type, action, project_context_id = null } = swipeData;

    const query = `
      INSERT INTO swipe_history (user_id, target_id, target_type, action, project_context_id)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE action = VALUES(action), created_at = CURRENT_TIMESTAMP
    `;

    const result = await db.query(query, [user_id, target_id, target_type, action, project_context_id]);
    return result;
  }

  static async hasUserSwipedTarget(userId, targetId, targetType, projectContextId = null) {
    const query = `
      SELECT * FROM swipe_history 
      WHERE user_id = ? AND target_id = ? AND target_type = ? 
      AND (project_context_id = ? OR (project_context_id IS NULL AND ? IS NULL))
    `;
    
    const result = await db.query(query, [userId, targetId, targetType, projectContextId, projectContextId]);
    return result.rows.length > 0;
  }

  static async getSwipeAction(userId, targetId, targetType, projectContextId = null) {
    const query = `
      SELECT action FROM swipe_history 
      WHERE user_id = ? AND target_id = ? AND target_type = ? 
      AND (project_context_id = ? OR (project_context_id IS NULL AND ? IS NULL))
    `;
    
    const result = await db.query(query, [userId, targetId, targetType, projectContextId, projectContextId]);
    return result.rows[0]?.action || null;
  }
}

module.exports = SwipeHistory;