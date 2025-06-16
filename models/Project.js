
const db = require('../config/database');

class Project {
  static async create(projectData) {
    const {
      idealizer_id, title, description, objectives, timeline, location_preference
    } = projectData;

    const query = `
      INSERT INTO projects (idealizer_id, title, description, objectives, timeline, location_preference)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      idealizer_id, title, description, objectives, timeline, location_preference
    ]);

    return { id: result.insertId, ...projectData };
  }

  static async findById(id) {
    const query = `
      SELECT p.*, u.email as idealizer_email, up.first_name, up.last_name
      FROM projects p
      JOIN users u ON p.idealizer_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE p.id = ?
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByIdealizerId(idealizerId) {
    const query = `
      SELECT p.*,
             COUNT(m.id) as match_count,
             COUNT(CASE WHEN m.status = 'accepted' THEN 1 END) as accepted_matches
      FROM projects p
      LEFT JOIN matches m ON p.id = m.project_id
      WHERE p.idealizer_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    const result = await db.query(query, [idealizerId]);
    return result.rows;
  }

  static async getAll(excludeIdealizerId = null) {
    let query = `
      SELECT p.*, u.email as idealizer_email, up.first_name, up.last_name,
             up.location as idealizer_location
      FROM projects p
      JOIN users u ON p.idealizer_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE p.status = 'active'
    `;

    const params = [];
    if (excludeIdealizerId) {
      query += ' AND p.idealizer_id != ?';
      params.push(excludeIdealizerId);
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  static async update(id, projectData) {
    const {
      title, description, objectives, timeline, location_preference, status
    } = projectData;

    const query = `
      UPDATE projects
      SET title = ?, description = ?, objectives = ?, timeline = ?,
          location_preference = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = await db.query(query, [
      title, description, objectives, timeline, location_preference, status, id
    ]);

    return result.rows[0];
  }

  static async delete(id) {
    const query = 'DELETE FROM projects WHERE id = ?';
    await db.query(query, [id]);
  }

  static async getProjectsForMatching(collaboratorId) {
    const query = `
      SELECT DISTINCT p.*, u.email as idealizer_email, up.first_name, up.last_name,
             up.location as idealizer_location
      FROM projects p
      JOIN users u ON p.idealizer_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN swipe_history sh ON (sh.user_id = ? AND sh.target_id = p.id AND sh.target_type = 'project')
      WHERE p.status = 'active'
        AND p.idealizer_id != ?
        AND sh.id IS NULL
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(query, [collaboratorId, collaboratorId]);
    return result.rows;
  }
}

module.exports = Project;
