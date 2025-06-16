const db = require('../config/database');

class SwipeHistory {
  static async create(swipeData) {
    const { user_id, target_id, target_type, action } = swipeData;

    // MySQL não tem ON CONFLICT, então usamos INSERT ... ON DUPLICATE KEY UPDATE
    const query = `
      INSERT INTO swipe_history (user_id, target_id, target_type, action)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      action = VALUES(action), created_at = CURRENT_TIMESTAMP
    `;

    const result = await db.query(query, [user_id, target_id, target_type, action]);
    return { id: result.insertId, ...swipeData };
  }

  static async hasUserSwiped(userId, targetId, targetType) {
    const query = `
      SELECT * FROM swipe_history 
      WHERE user_id = ? AND target_id = ? AND target_type = ?
    `;
    const result = await db.query(query, [userId, targetId, targetType]);
    return result.rows[0];
  }

  static async getUserSwipes(userId, targetType = null) {
    let query = 'SELECT * FROM swipe_history WHERE user_id = ?';
    const params = [userId];

    if (targetType) {
      query += ' AND target_type = ?';
      params.push(targetType);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = SwipeHistory;