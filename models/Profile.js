const db = require('../config/database');

class Profile {
  static async create(profileData) {
    const {
      user_id, first_name, last_name, bio, location,
      experience_level, contact_info, portfolio_links, availability
    } = profileData;

    const query = `
      INSERT INTO user_profiles 
      (user_id, first_name, last_name, bio, location, experience_level, 
       contact_info, portfolio_links, availability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      user_id, first_name, last_name, bio, location,
      experience_level, contact_info, portfolio_links, availability
    ]);

    // O trigger tr_profile_complete_insert irá automaticamente marcar o perfil como completo
    return result;
  }

  static async update(user_id, profileData) {
    const {
      first_name, last_name, bio, location,
      experience_level, contact_info, portfolio_links, availability
    } = profileData;

    const query = `
      UPDATE user_profiles 
      SET first_name = ?, last_name = ?, bio = ?, location = ?, 
          experience_level = ?, contact_info = ?, portfolio_links = ?, 
          availability = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;

    const result = await db.query(query, [
      first_name, last_name, bio, location,
      experience_level, contact_info, portfolio_links, availability,
      user_id
    ]);

    // O trigger tr_profile_complete_update irá automaticamente marcar o perfil como completo
    if (result.affectedRows === 0) {
      throw new Error('Profile not found or no changes made');
    }

    return result;
  }

  static async findByUserId(user_id) {
    const query = 'SELECT * FROM user_profiles WHERE user_id = ?';
    const result = await db.query(query, [user_id]);
    
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  }

  static async upsert(user_id, profileData) {
    try {
      console.log('🔍 Profile upsert for user:', user_id);
      console.log('📝 Profile data:', profileData);
      
      const existingProfile = await this.findByUserId(user_id);
      console.log('📋 Existing profile:', existingProfile ? 'Found' : 'Not found');

      if (existingProfile) {
        console.log('🔄 Updating existing profile');
        await this.update(user_id, profileData);
      } else {
        console.log('➕ Creating new profile');
        await this.create({ user_id, ...profileData });
      }

      // Os triggers já marcam o perfil como completo automaticamente
      console.log('✅ Profile marked as complete by trigger');

      return true;
    } catch (error) {
      console.error('❌ Profile upsert error:', error);
      throw error;
    }
  }

  static async deleteByUserId(user_id) {
    const query = 'DELETE FROM user_profiles WHERE user_id = ?';
    const result = await db.query(query, [user_id]);
    return result;
  }

  static async getAllProfiles() {
    const query = `
      SELECT up.*, u.email, u.user_type 
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      ORDER BY up.created_at DESC
    `;
    const result = await db.query(query);
    return result.rows || [];
  }
}

module.exports = Profile;