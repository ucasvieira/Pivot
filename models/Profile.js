const db = require('../config/database');

class Profile {
  static async create(profileData) {
    const {
      user_id, first_name, last_name, bio, location, experience_level,
      contact_info, portfolio_links, availability, profile_picture
    } = profileData;

    const query = `
      INSERT INTO user_profiles (
        user_id, first_name, last_name, bio, location, experience_level,
        contact_info, portfolio_links, availability, profile_picture
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      user_id, first_name, last_name, bio, location, experience_level,
      JSON.stringify(contact_info), JSON.stringify(portfolio_links), 
      availability, profile_picture
    ]);

    return { id: result.insertId, ...profileData };
  }

  static async update(userId, profileData) {
    const {
      first_name, last_name, bio, location, experience_level,
      contact_info, portfolio_links, availability, profile_picture
    } = profileData;

    const query = `
      UPDATE user_profiles 
      SET first_name = ?, last_name = ?, bio = ?, location = ?, 
          experience_level = ?, contact_info = ?, portfolio_links = ?,
          availability = ?, profile_picture = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;

    const result = await db.query(query, [
      first_name, last_name, bio, location, experience_level,
      JSON.stringify(contact_info), JSON.stringify(portfolio_links),
      availability, profile_picture, userId
    ]);

    return result.rows[0];
  }

  static async findByUserId(userId) {
    const query = 'SELECT * FROM user_profiles WHERE user_id = ?';
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  static async upsert(userId, profileData) {
    const existing = await this.findByUserId(userId);
    
    if (existing) {
      return await this.update(userId, profileData);
    } else {
      return await this.create({ user_id: userId, ...profileData });
    }
  }
}

module.exports = Profile;