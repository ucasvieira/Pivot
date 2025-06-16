
const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { email, password, user_type, github_id, google_id } = userData;

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const query = `
      INSERT INTO users (email, password, user_type, github_id, google_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      email,
      hashedPassword,
      user_type,
      github_id || null,
      google_id || null
    ]);

    console.log('User creation result:', result); // Debug

    return {
      id: result.insertId,
      email,
      user_type,
      github_id: github_id || null,
      google_id: google_id || null
    };
  }

  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = ?';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ?';
    const result = await db.query(query, [email]);
    return result.rows[0];
  }

  static async findByGitHubId(githubId) {
    const query = 'SELECT * FROM users WHERE github_id = ?';
    const result = await db.query(query, [githubId]);
    return result.rows[0];
  }

  static async findByGoogleId(googleId) {
    const query = 'SELECT * FROM users WHERE google_id = ?';
    const result = await db.query(query, [googleId]);
    return result.rows[0];
  }

  static async updateProfileComplete(id, isComplete) {
    const query = 'UPDATE users SET is_profile_complete = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await db.query(query, [isComplete, id]);
  }

  static async getWithProfile(id) {
    const query = `
      SELECT u.*, up.first_name, up.last_name, up.bio, up.location,
             up.experience_level, up.contact_info, up.portfolio_links,
             up.availability, up.profile_picture
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id = ?
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async getAllCollaborators(excludeUserId = null) {
    let query = `
      SELECT u.id, u.email, u.user_type, up.first_name, up.last_name,
             up.bio, up.location, up.experience_level, up.availability,
             up.profile_picture
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.user_type = 'collaborator' AND u.is_profile_complete = true
    `;

    const params = [];
    if (excludeUserId) {
      query += ' AND u.id != ?';
      params.push(excludeUserId);
    }

    query += ' ORDER BY u.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = User;
