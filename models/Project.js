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
    // Usar view para buscar projeto com informações do idealizador
    const query = `SELECT * FROM vw_projects_with_idealizer WHERE id = ?`;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByIdealizerId(idealizerId) {
    // Corrigir a query para incluir todas as colunas no GROUP BY
    const query = `
      SELECT 
        p.id,
        p.idealizer_id,
        p.title,
        p.description,
        p.objectives,
        p.timeline,
        p.location_preference,
        p.status,
        p.created_at,
        p.updated_at,
        p.idealizer_email,
        p.idealizer_first_name,
        p.idealizer_last_name,
        p.idealizer_location,
        p.idealizer_picture,
        COUNT(m.id) as match_count,
        COUNT(CASE WHEN m.status = 'accepted' THEN 1 END) as accepted_matches
      FROM vw_projects_with_idealizer p
      LEFT JOIN matches m ON p.id = m.project_id
      WHERE p.idealizer_id = ?
      GROUP BY 
        p.id,
        p.idealizer_id,
        p.title,
        p.description,
        p.objectives,
        p.timeline,
        p.location_preference,
        p.status,
        p.created_at,
        p.updated_at,
        p.idealizer_email,
        p.idealizer_first_name,
        p.idealizer_last_name,
        p.idealizer_location,
        p.idealizer_picture
      ORDER BY p.created_at DESC
    `;
    const result = await db.query(query, [idealizerId]);
    return result.rows;
  }

  static async getAll(excludeIdealizerId = null) {
    let query = `
      SELECT * FROM vw_projects_with_idealizer
      WHERE status = 'active'
    `;

    const params = [];
    if (excludeIdealizerId) {
      query += ' AND idealizer_id != ?';
      params.push(excludeIdealizerId);
    }

    query += ' ORDER BY created_at DESC';

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
    try {
      // Usar stored procedure para buscar projetos para matching
      console.log('🔍 Calling stored procedure for projects matching...');
      
      // Para stored procedures, precisamos usar uma abordagem diferente
      const connection = await db.pool.getConnection();
      
      try {
        const [results] = await connection.execute('CALL sp_get_projects_for_matching(?)', [collaboratorId]);
        
        // O resultado de uma stored procedure vem em um array, onde o primeiro elemento são os dados
        const projects = results[0] || [];
        
        console.log(`📋 Found ${projects.length} projects for matching`);
        return projects;
        
      } finally {
        connection.release();
      }
      
    } catch (error) {
      console.error('❌ Error calling stored procedure, falling back to direct query:', error);
      
      // Fallback para query direta se a stored procedure falhar
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
}

module.exports = Project;