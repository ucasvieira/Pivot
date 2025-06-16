const db = require('../config/database');

class Skill {
  static async getAll() {
    const query = 'SELECT * FROM skills ORDER BY category, name';
    const result = await db.query(query);
    return result.rows;
  }

  static async findById(id) {
    const query = 'SELECT * FROM skills WHERE id = ?';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async getUserSkills(userId) {
    const query = `
      SELECT s.*, us.proficiency_level
      FROM skills s
      JOIN user_skills us ON s.id = us.skill_id
      WHERE us.user_id = ?
      ORDER BY s.category, s.name
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async addUserSkill(userId, skillId, proficiencyLevel) {
    // MySQL não tem ON CONFLICT, então usamos INSERT ... ON DUPLICATE KEY UPDATE
    const query = `
      INSERT INTO user_skills (user_id, skill_id, proficiency_level)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      proficiency_level = VALUES(proficiency_level)
    `;
    const result = await db.query(query, [userId, skillId, proficiencyLevel]);
    return { user_id: userId, skill_id: skillId, proficiency_level: proficiencyLevel };
  }

  static async removeUserSkill(userId, skillId) {
    const query = 'DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?';
    await db.query(query, [userId, skillId]);
  }

  static async updateUserSkills(userId, skills) {
    // First, remove all existing skills for the user
    await db.query('DELETE FROM user_skills WHERE user_id = ?', [userId]);
    
    // Then add the new skills
    for (const skill of skills) {
      await this.addUserSkill(userId, skill.skill_id, skill.proficiency_level);
    }
  }

  static async getProjectSkills(projectId) {
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

  static async addProjectSkill(projectId, skillId, requiredLevel) {
    // MySQL não tem ON CONFLICT, então usamos INSERT ... ON DUPLICATE KEY UPDATE
    const query = `
      INSERT INTO project_skills (project_id, skill_id, required_level)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      required_level = VALUES(required_level)
    `;
    const result = await db.query(query, [projectId, skillId, requiredLevel]);
    return { project_id: projectId, skill_id: skillId, required_level: requiredLevel };
  }

  static async updateProjectSkills(projectId, skills) {
    // First, remove all existing skills for the project
    await db.query('DELETE FROM project_skills WHERE project_id = ?', [projectId]);
    
    // Then add the new skills
    for (const skill of skills) {
      await this.addProjectSkill(projectId, skill.skill_id, skill.required_level);
    }
  }
}

module.exports = Skill;