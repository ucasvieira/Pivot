const db = require('../config/database');

class ProjectSkill {
  static async create(projectSkillData) {
    const { project_id, skill_id, required_level } = projectSkillData;

    const query = `
      INSERT INTO project_skills (project_id, skill_id, required_level)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE required_level = VALUES(required_level)
    `;

    const result = await db.query(query, [project_id, skill_id, required_level]);
    return { id: result.insertId, ...projectSkillData };
  }

  static async findById(id) {
    const query = `
      SELECT ps.*, s.name as skill_name, s.category as skill_category
      FROM project_skills ps
      JOIN skills s ON ps.skill_id = s.id
      WHERE ps.id = ?
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async getByProjectId(projectId) {
    const query = `
      SELECT ps.*, s.name as skill_name, s.category as skill_category
      FROM project_skills ps
      JOIN skills s ON ps.skill_id = s.id
      WHERE ps.project_id = ?
      ORDER BY s.category, s.name
    `;
    const result = await db.query(query, [projectId]);
    return result.rows;
  }

  static async getBySkillId(skillId) {
    const query = `
      SELECT ps.*, p.title as project_title, p.description as project_description
      FROM project_skills ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.skill_id = ?
      ORDER BY p.created_at DESC
    `;
    const result = await db.query(query, [skillId]);
    return result.rows;
  }

  static async deleteByProjectId(projectId) {
    const query = 'DELETE FROM project_skills WHERE project_id = ?';
    await db.query(query, [projectId]);
  }

  static async deleteBySkillId(skillId) {
    const query = 'DELETE FROM project_skills WHERE skill_id = ?';
    await db.query(query, [skillId]);
  }

  static async delete(id) {
    const query = 'DELETE FROM project_skills WHERE id = ?';
    await db.query(query, [id]);
  }

  static async deleteByProjectAndSkill(projectId, skillId) {
    const query = 'DELETE FROM project_skills WHERE project_id = ? AND skill_id = ?';
    await db.query(query, [projectId, skillId]);
  }

  static async getProjectsBySkill(skillId, requiredLevel = null) {
    let query = `
      SELECT DISTINCT p.*, ps.required_level,
             u.email as idealizer_email,
             up.first_name as idealizer_first_name,
             up.last_name as idealizer_last_name
      FROM projects p
      JOIN project_skills ps ON p.id = ps.project_id
      JOIN users u ON p.idealizer_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE ps.skill_id = ?
    `;

    const params = [skillId];

    if (requiredLevel) {
      query += ' AND ps.required_level = ?';
      params.push(requiredLevel);
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  static async getSkillsByProject(projectId) {
    const query = `
      SELECT s.*, ps.required_level
      FROM skills s
      JOIN project_skills ps ON s.id = ps.skill_id
      WHERE ps.project_id = ?
      ORDER BY s.category, s.name
    `;
    const result = await db.query(query, [projectId]);
    return result.rows;
  }

  static async updateRequiredLevel(projectId, skillId, requiredLevel) {
    const query = `
      UPDATE project_skills 
      SET required_level = ?
      WHERE project_id = ? AND skill_id = ?
    `;
    await db.query(query, [requiredLevel, projectId, skillId]);
  }

  static async getProjectSkillsCount(projectId) {
    const query = 'SELECT COUNT(*) as count FROM project_skills WHERE project_id = ?';
    const result = await db.query(query, [projectId]);
    return result.rows[0].count;
  }

  static async getSkillProjectsCount(skillId) {
    const query = 'SELECT COUNT(*) as count FROM project_skills WHERE skill_id = ?';
    const result = await db.query(query, [skillId]);
    return result.rows[0].count;
  }

  static async bulkCreate(projectId, skillsData) {
    if (!skillsData || skillsData.length === 0) {
      return [];
    }

    // Primeiro, deletar skills existentes do projeto
    await this.deleteByProjectId(projectId);

    // Inserir novas skills
    const results = [];
    for (const skillData of skillsData) {
      const result = await this.create({
        project_id: projectId,
        skill_id: skillData.skill_id,
        required_level: skillData.required_level || 'intermediate'
      });
      results.push(result);
    }

    return results;
  }

  static async getMatchingProjects(userSkills, excludeUserId = null) {
    if (!userSkills || userSkills.length === 0) {
      return [];
    }

    const skillIds = userSkills.map(skill => skill.skill_id);
    const placeholders = skillIds.map(() => '?').join(',');

    let query = `
      SELECT DISTINCT p.*, 
             COUNT(ps.skill_id) as matching_skills,
             u.email as idealizer_email,
             up.first_name as idealizer_first_name,
             up.last_name as idealizer_last_name
      FROM projects p
      JOIN project_skills ps ON p.id = ps.project_id
      JOIN users u ON p.idealizer_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE ps.skill_id IN (${placeholders})
      AND p.status = 'active'
    `;

    const params = [...skillIds];

    if (excludeUserId) {
      query += ' AND p.idealizer_id != ?';
      params.push(excludeUserId);
    }

    query += `
      GROUP BY p.id
      ORDER BY matching_skills DESC, p.created_at DESC
    `;

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = ProjectSkill;