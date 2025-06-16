const db = require('../config/database');

class Match {
  static async create(matchData) {
    const { project_id, collaborator_id, idealizer_id } = matchData;

    // MySQL não tem ON CONFLICT, então verificamos primeiro se já existe
    const existingQuery = 'SELECT * FROM matches WHERE project_id = ? AND collaborator_id = ?';
    const existing = await db.query(existingQuery, [project_id, collaborator_id]);
    
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const query = `
      INSERT INTO matches (project_id, collaborator_id, idealizer_id, collaborator_interested, idealizer_interested, status)
      VALUES (?, ?, ?, false, false, 'pending')
    `;

    const result = await db.query(query, [project_id, collaborator_id, idealizer_id]);
    return { id: result.insertId, ...matchData, collaborator_interested: false, idealizer_interested: false, status: 'pending' };
  }

  static async findById(id) {
    const query = `
      SELECT m.*, p.title as project_title, p.description as project_description,
             u1.email as collaborator_email, up1.first_name as collaborator_first_name,
             up1.last_name as collaborator_last_name,
             u2.email as idealizer_email, up2.first_name as idealizer_first_name,
             up2.last_name as idealizer_last_name
      FROM matches m
      JOIN projects p ON m.project_id = p.id
      JOIN users u1 ON m.collaborator_id = u1.id
      JOIN users u2 ON m.idealizer_id = u2.id
      LEFT JOIN user_profiles up1 ON u1.id = up1.user_id
      LEFT JOIN user_profiles up2 ON u2.id = up2.user_id
      WHERE m.id = ?
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByUserAndProject(collaboratorId, projectId) {
    const query = 'SELECT * FROM matches WHERE collaborator_id = ? AND project_id = ?';
    const result = await db.query(query, [collaboratorId, projectId]);
    return result.rows[0];
  }

  static async updateInterest(matchId, userType, interested) {
    console.log(`Atualizando interesse - Match ID: ${matchId}, User Type: ${userType}, Interested: ${interested}`);
    
    // Converter para boolean explicitamente
    const isInterested = Boolean(interested);
    const field = userType === 'collaborator' ? 'collaborator_interested' : 'idealizer_interested';
    
    // Atualizar o interesse
    const updateQuery = `UPDATE matches SET ${field} = ? WHERE id = ?`;
    await db.query(updateQuery, [isInterested, matchId]);
    
    // Buscar o match atualizado
    const matchQuery = 'SELECT * FROM matches WHERE id = ?';
    const matchResult = await db.query(matchQuery, [matchId]);
    const match = matchResult.rows[0];
    
    if (!match) {
      console.log(`Match não encontrado: ${matchId}`);
      return null;
    }

    console.log(`Estado atual do match:`, {
      id: match.id,
      collaborator_interested: match.collaborator_interested,
      idealizer_interested: match.idealizer_interested,
      status: match.status
    });

    // Verificar se ambas as partes estão interessadas
    const collaboratorInterested = Boolean(match.collaborator_interested);
    const idealizerInterested = Boolean(match.idealizer_interested);
    
    if (collaboratorInterested && idealizerInterested && match.status !== 'accepted') {
      console.log('Ambas as partes interessadas! Atualizando status para accepted e criando conversa');
      
      // Iniciar transação para garantir consistência
      await db.query('START TRANSACTION');
      
      try {
        // Atualizar o status do match
        await db.query('UPDATE matches SET status = ? WHERE id = ?', ['accepted', matchId]);
        
        // Verificar se já existe uma conversa para este match
        const existingConversationQuery = 'SELECT * FROM conversations WHERE match_id = ?';
        const existingConversation = await db.query(existingConversationQuery, [matchId]);
        
        if (existingConversation.rows.length === 0) {
          // Criar uma nova conversa
          const createConversationQuery = 'INSERT INTO conversations (match_id) VALUES (?)';
          const conversationResult = await db.query(createConversationQuery, [matchId]);
          
          console.log(`Conversa criada com ID: ${conversationResult.insertId} para match ${matchId}`);
        } else {
          console.log(`Conversa já existe para match ${matchId}: ID ${existingConversation.rows[0].id}`);
        }
        
        // Confirmar transação
        await db.query('COMMIT');
        
      } catch (error) {
        // Reverter transação em caso de erro
        await db.query('ROLLBACK');
        console.error('Erro ao criar conversa:', error);
        throw error;
      }
      
      // Buscar novamente para retornar dados atualizados
      const updatedResult = await db.query(matchQuery, [matchId]);
      const updatedMatch = updatedResult.rows[0];
      
      console.log(`Match aceito e conversa criada! Match ID: ${matchId}`);
      return updatedMatch;
    }
    
    return match;
  }

  static async getUserMatches(userId, userType) {
    const isCollaborator = userType === 'collaborator';
    const userIdField = isCollaborator ? 'collaborator_id' : 'idealizer_id';
    const otherUserIdField = isCollaborator ? 'idealizer_id' : 'collaborator_id';

    const query = `
      SELECT m.*, p.title as project_title, p.description as project_description,
             u.email as other_user_email, up.first_name as other_user_first_name,
             up.last_name as other_user_last_name, up.profile_picture as other_user_picture
      FROM matches m
      JOIN projects p ON m.project_id = p.id
      JOIN users u ON m.${otherUserIdField} = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE m.${userIdField} = ?
      ORDER BY m.created_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async getAcceptedMatches(userId) {
    const query = `
      SELECT m.*, p.title as project_title, p.description as project_description,
             u1.email as collaborator_email, up1.first_name as collaborator_first_name,
             up1.last_name as collaborator_last_name, up1.profile_picture as collaborator_picture,
             u2.email as idealizer_email, up2.first_name as idealizer_first_name,
             up2.last_name as idealizer_last_name, up2.profile_picture as idealizer_picture,
             c.id as conversation_id
      FROM matches m
      JOIN projects p ON m.project_id = p.id
      JOIN users u1 ON m.collaborator_id = u1.id
      JOIN users u2 ON m.idealizer_id = u2.id
      LEFT JOIN user_profiles up1 ON u1.id = up1.user_id
      LEFT JOIN user_profiles up2 ON u2.id = up2.user_id
      LEFT JOIN conversations c ON c.match_id = m.id
      WHERE (m.collaborator_id = ? OR m.idealizer_id = ?) 
      AND m.status = 'accepted'
      ORDER BY m.created_at DESC
    `;

    const result = await db.query(query, [userId, userId]);
    return result.rows;
  }
}

module.exports = Match;