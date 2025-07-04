const db = require('../config/database');

class Skill {
  static async create(skillData) {
    const { name, category } = skillData;

    const query = `
      INSERT INTO skills (name, category)
      VALUES (?, ?)
    `;

    const result = await db.query(query, [name, category]);
    return { id: result.insertId, ...skillData };
  }

  static async findById(id) {
    const query = 'SELECT * FROM skills WHERE id = ?';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByName(name) {
    const query = 'SELECT * FROM skills WHERE name = ?';
    const result = await db.query(query, [name]);
    return result.rows[0];
  }

  static async getAll() {
    const query = 'SELECT * FROM skills ORDER BY category, name';
    const result = await db.query(query);
    return result.rows;
  }

  static async getByCategory(category) {
    const query = 'SELECT * FROM skills WHERE category = ? ORDER BY name';
    const result = await db.query(query, [category]);
    return result.rows;
  }

  static async getAllCategories() {
    const query = 'SELECT DISTINCT category FROM skills ORDER BY category';
    const result = await db.query(query);
    return result.rows.map(row => row.category);
  }

  static async update(id, skillData) {
    const { name, category } = skillData;

    const query = `
      UPDATE skills
      SET name = ?, category = ?
      WHERE id = ?
    `;

    await db.query(query, [name, category, id]);
    return { id, ...skillData };
  }

  static async delete(id) {
    const query = 'DELETE FROM skills WHERE id = ?';
    await db.query(query, [id]);
  }

  static async search(searchTerm) {
    const query = `
      SELECT * FROM skills 
      WHERE name LIKE ? OR category LIKE ?
      ORDER BY category, name
    `;
    const searchPattern = `%${searchTerm}%`;
    const result = await db.query(query, [searchPattern, searchPattern]);
    return result.rows;
  }

  static async getPopularSkills(limit = 10) {
    const query = `
      SELECT s.*, COUNT(us.id) as user_count, COUNT(ps.id) as project_count
      FROM skills s
      LEFT JOIN user_skills us ON s.id = us.skill_id
      LEFT JOIN project_skills ps ON s.id = ps.skill_id
      GROUP BY s.id
      ORDER BY (COUNT(us.id) + COUNT(ps.id)) DESC
      LIMIT ?
    `;
    const result = await db.query(query, [limit]);
    return result.rows;
  }

  static async getSkillsWithCounts() {
    const query = `
      SELECT s.*, 
             COUNT(DISTINCT us.id) as user_count,
             COUNT(DISTINCT ps.id) as project_count
      FROM skills s
      LEFT JOIN user_skills us ON s.id = us.skill_id
      LEFT JOIN project_skills ps ON s.id = ps.skill_id
      GROUP BY s.id
      ORDER BY s.category, s.name
    `;
    const result = await db.query(query);
    return result.rows;
  }

  static async bulkCreate(skillsData) {
    const results = [];
    for (const skillData of skillsData) {
      // Verificar se a skill já existe
      const existing = await this.findByName(skillData.name);
      if (!existing) {
        const result = await this.create(skillData);
        results.push(result);
      } else {
        results.push(existing);
      }
    }
    return results;
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