
-- Drop views, functions, procedures and triggers in reverse order of dependencies
DROP VIEW IF EXISTS vw_conversations_with_last_message;
DROP VIEW IF EXISTS vw_matches_complete;
DROP VIEW IF EXISTS vw_projects_with_idealizer;

DROP TRIGGER IF EXISTS tr_swipe_activity_log;
DROP TRIGGER IF EXISTS tr_profile_complete_update;
DROP TRIGGER IF EXISTS tr_profile_complete_insert;
DROP TRIGGER IF EXISTS tr_match_accepted_create_conversation;

DROP PROCEDURE IF EXISTS sp_get_projects_for_matching;
DROP PROCEDURE IF EXISTS sp_update_match_interest;
DROP PROCEDURE IF EXISTS sp_check_and_create_match;
DROP PROCEDURE IF EXISTS sp_create_swipe;

DROP FUNCTION IF EXISTS fn_count_user_matches;
DROP FUNCTION IF EXISTS fn_get_swipe_action;
DROP FUNCTION IF EXISTS fn_has_user_swiped;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS swipe_history;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS project_skills;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS user_skills;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS sessions;

-- Sessions table
CREATE TABLE sessions (
  session_id varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  expires int(11) unsigned NOT NULL,
  data mediumtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    user_type ENUM('idealizer', 'collaborator') NULL,
    github_id VARCHAR(255),
    google_id VARCHAR(255),
    is_profile_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE user_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    bio TEXT,
    location VARCHAR(255),
    experience_level ENUM('beginner', 'intermediate', 'advanced'),
    contact_info JSON,
    portfolio_links JSON,
    availability VARCHAR(50),
    profile_picture VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Skills table
CREATE TABLE skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50)
);

-- User skills junction table
CREATE TABLE user_skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    skill_id INT,
    proficiency_level ENUM('beginner', 'intermediate', 'advanced'),
    UNIQUE KEY unique_user_skill (user_id, skill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- Projects table
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    idealizer_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    objectives TEXT,
    timeline VARCHAR(100),
    location_preference VARCHAR(255),
    status ENUM('active', 'paused', 'completed', 'cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (idealizer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Project required skills junction table
CREATE TABLE project_skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    skill_id INT,
    required_level ENUM('beginner', 'intermediate', 'advanced'),
    UNIQUE KEY unique_project_skill (project_id, skill_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- Matches table
CREATE TABLE matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    collaborator_id INT,
    idealizer_id INT,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    collaborator_interested BOOLEAN DEFAULT FALSE,
    idealizer_interested BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_match (project_id, collaborator_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (collaborator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (idealizer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat conversations table
CREATE TABLE conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Chat messages table
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT,
    sender_id INT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Swipe history table (CORRIGIDA)
CREATE TABLE swipe_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    target_id INT NOT NULL,
    target_type ENUM('project', 'user') NOT NULL,
    project_context_id INT NULL,
    action ENUM('like', 'pass') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_swipe_with_context (user_id, target_id, target_type, project_context_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_context_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Insert default skills
INSERT IGNORE INTO skills (name, category) VALUES
('JavaScript', 'Programming'),
('Python', 'Programming'),
('Java', 'Programming'),
('C++', 'Programming'),
('React', 'Frontend'),
('Vue.js', 'Frontend'),
('Angular', 'Frontend'),
('Node.js', 'Backend'),
('Express.js', 'Backend'),
('Django', 'Backend'),
('Flask', 'Backend'),
('Spring Boot', 'Backend'),
('MySQL', 'Database'),
('PostgreSQL', 'Database'),
('MongoDB', 'Database'),
('Redis', 'Database'),
('AWS', 'Cloud'),
('Azure', 'Cloud'),
('Google Cloud', 'Cloud'),
('Docker', 'DevOps'),
('Kubernetes', 'DevOps'),
('Git', 'Tools'),
('UI/UX Design', 'Design'),
('Figma', 'Design'),
('Photoshop', 'Design'),
('Mobile Development', 'Mobile'),
('iOS Development', 'Mobile'),
('Android Development', 'Mobile'),
('React Native', 'Mobile'),
('Flutter', 'Mobile'),
('Machine Learning', 'AI/ML'),
('Data Science', 'AI/ML'),
('TensorFlow', 'AI/ML'),
('PyTorch', 'AI/ML');

-- ==== VIEWS ====

-- View para listar projetos com informações do idealizador (CORRIGIDA)
CREATE VIEW vw_projects_with_idealizer AS
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
    u.email as idealizer_email,
    up.first_name as idealizer_first_name,
    up.last_name as idealizer_last_name,
    up.location as idealizer_location,
    up.profile_picture as idealizer_picture
FROM projects p
JOIN users u ON p.idealizer_id = u.id
LEFT JOIN user_profiles up ON u.id = up.user_id;

-- View para matches com informações completas
CREATE VIEW vw_matches_complete AS
SELECT 
    m.id,
    m.project_id,
    m.collaborator_id,
    m.idealizer_id,
    m.status,
    m.collaborator_interested,
    m.idealizer_interested,
    m.created_at,
    p.title as project_title,
    p.description as project_description,
    u1.email as collaborator_email,
    up1.first_name as collaborator_first_name,
    up1.last_name as collaborator_last_name,
    up1.profile_picture as collaborator_picture,
    u2.email as idealizer_email,
    up2.first_name as idealizer_first_name,
    up2.last_name as idealizer_last_name,
    up2.profile_picture as idealizer_picture
FROM matches m
JOIN projects p ON m.project_id = p.id
JOIN users u1 ON m.collaborator_id = u1.id
JOIN users u2 ON m.idealizer_id = u2.id
LEFT JOIN user_profiles up1 ON u1.id = up1.user_id
LEFT JOIN user_profiles up2 ON u2.id = up2.user_id;

-- View para conversas com última mensagem
CREATE VIEW vw_conversations_with_last_message AS
SELECT 
    c.id as conversation_id,
    c.match_id,
    c.created_at,
    m.project_id,
    p.title as project_title,
    m.collaborator_id,
    m.idealizer_id,
    up1.first_name as collaborator_first_name,
    up1.last_name as collaborator_last_name,
    up1.profile_picture as collaborator_picture,
    up2.first_name as idealizer_first_name,
    up2.last_name as idealizer_last_name,
    up2.profile_picture as idealizer_picture,
    (SELECT msg.message FROM messages msg WHERE msg.conversation_id = c.id ORDER BY msg.created_at DESC LIMIT 1) as last_message,
    (SELECT msg.created_at FROM messages msg WHERE msg.conversation_id = c.id ORDER BY msg.created_at DESC LIMIT 1) as last_message_time
FROM conversations c
JOIN matches m ON c.match_id = m.id
JOIN projects p ON m.project_id = p.id
LEFT JOIN user_profiles up1 ON m.collaborator_id = up1.user_id
LEFT JOIN user_profiles up2 ON m.idealizer_id = up2.user_id;

-- ==== FUNCTIONS ====

-- Function para verificar se usuário já deu swipe em um target
CREATE FUNCTION fn_has_user_swiped(
    p_user_id INT,
    p_target_id INT,
    p_target_type ENUM('project', 'user'),
    p_project_context_id INT
) RETURNS BOOLEAN
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE swipe_count INT DEFAULT 0;
    
    SELECT COUNT(*) INTO swipe_count
    FROM swipe_history 
    WHERE user_id = p_user_id 
    AND target_id = p_target_id 
    AND target_type = p_target_type
    AND (project_context_id = p_project_context_id OR (project_context_id IS NULL AND p_project_context_id IS NULL));
    
    RETURN swipe_count > 0;
END;

-- Function para obter ação do swipe
CREATE FUNCTION fn_get_swipe_action(
    p_user_id INT,
    p_target_id INT,
    p_target_type ENUM('project', 'user'),
    p_project_context_id INT
) RETURNS ENUM('like', 'pass')
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE swipe_action ENUM('like', 'pass') DEFAULT NULL;
    
    SELECT action INTO swipe_action
    FROM swipe_history 
    WHERE user_id = p_user_id 
    AND target_id = p_target_id 
    AND target_type = p_target_type
    AND (project_context_id = p_project_context_id OR (project_context_id IS NULL AND p_project_context_id IS NULL))
    LIMIT 1;
    
    RETURN swipe_action;
END;

-- Function para contar matches por usuário
CREATE FUNCTION fn_count_user_matches(
    p_user_id INT,
    p_status VARCHAR(20)
) RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE match_count INT DEFAULT 0;
    
    IF p_status IS NULL THEN
        SELECT COUNT(*) INTO match_count
        FROM matches 
        WHERE collaborator_id = p_user_id OR idealizer_id = p_user_id;
    ELSE
        SELECT COUNT(*) INTO match_count
        FROM matches 
        WHERE (collaborator_id = p_user_id OR idealizer_id = p_user_id)
        AND status = p_status;
    END IF;
    
    RETURN match_count;
END;

-- ==== STORED PROCEDURES ====

-- Procedure para criar swipe com verificação de duplicatas
CREATE PROCEDURE sp_create_swipe(
    IN p_user_id INT,
    IN p_target_id INT,
    IN p_target_type ENUM('project', 'user'),
    IN p_action ENUM('like', 'pass'),
    IN p_project_context_id INT,
    OUT p_swipe_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    INSERT INTO swipe_history (user_id, target_id, target_type, action, project_context_id)
    VALUES (p_user_id, p_target_id, p_target_type, p_action, p_project_context_id)
    ON DUPLICATE KEY UPDATE 
        action = VALUES(action), 
        created_at = CURRENT_TIMESTAMP;
    
    SET p_swipe_id = LAST_INSERT_ID();
    
    COMMIT;
END;

-- Procedure para verificar e criar match
CREATE PROCEDURE sp_check_and_create_match(
    IN p_project_id INT,
    IN p_collaborator_id INT,
    IN p_idealizer_id INT,
    OUT p_match_id INT,
    OUT p_is_new_match BOOLEAN
)
BEGIN
    DECLARE v_collaborator_action ENUM('like', 'pass');
    DECLARE v_idealizer_action ENUM('like', 'pass');
    DECLARE v_existing_match_id INT DEFAULT NULL;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Verificar ações de swipe
    SET v_collaborator_action = fn_get_swipe_action(p_collaborator_id, p_project_id, 'project', NULL);
    SET v_idealizer_action = fn_get_swipe_action(p_idealizer_id, p_collaborator_id, 'user', p_project_id);
    
    -- Verificar se já existe match
    SELECT id INTO v_existing_match_id
    FROM matches 
    WHERE project_id = p_project_id AND collaborator_id = p_collaborator_id
    LIMIT 1;
    
    SET p_is_new_match = FALSE;
    
    -- Se ambos deram like
    IF v_collaborator_action = 'like' AND v_idealizer_action = 'like' THEN
        IF v_existing_match_id IS NULL THEN
            -- Criar novo match
            INSERT INTO matches (project_id, collaborator_id, idealizer_id, collaborator_interested, idealizer_interested, status)
            VALUES (p_project_id, p_collaborator_id, p_idealizer_id, TRUE, TRUE, 'accepted');
            
            SET p_match_id = LAST_INSERT_ID();
            SET p_is_new_match = TRUE;
            
            -- Criar conversa automaticamente
            INSERT INTO conversations (match_id) VALUES (p_match_id);
        ELSE
            -- Atualizar match existente
            UPDATE matches 
            SET collaborator_interested = TRUE, 
                idealizer_interested = TRUE, 
                status = 'accepted'
            WHERE id = v_existing_match_id;
            
            SET p_match_id = v_existing_match_id;
        END IF;
    ELSE
        SET p_match_id = v_existing_match_id;
    END IF;
    
    COMMIT;
END;

-- Procedure para atualizar interesse em match
CREATE PROCEDURE sp_update_match_interest(
    IN p_match_id INT,
    IN p_user_type ENUM('collaborator', 'idealizer'),
    IN p_interested BOOLEAN,
    OUT p_conversation_id INT
)
BEGIN
    DECLARE v_collaborator_interested BOOLEAN DEFAULT FALSE;
    DECLARE v_idealizer_interested BOOLEAN DEFAULT FALSE;
    DECLARE v_existing_conversation_id INT DEFAULT NULL;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Atualizar interesse
    IF p_user_type = 'collaborator' THEN
        UPDATE matches SET collaborator_interested = p_interested WHERE id = p_match_id;
    ELSE
        UPDATE matches SET idealizer_interested = p_interested WHERE id = p_match_id;
    END IF;
    
    -- Verificar estado atual
    SELECT collaborator_interested, idealizer_interested 
    INTO v_collaborator_interested, v_idealizer_interested
    FROM matches WHERE id = p_match_id;
    
    -- Se ambos interessados, aceitar match e criar conversa
    IF v_collaborator_interested = TRUE AND v_idealizer_interested = TRUE THEN
        UPDATE matches SET status = 'accepted' WHERE id = p_match_id;
        
        -- Verificar se já existe conversa
        SELECT id INTO v_existing_conversation_id
        FROM conversations WHERE match_id = p_match_id LIMIT 1;
        
        IF v_existing_conversation_id IS NULL THEN
            INSERT INTO conversations (match_id) VALUES (p_match_id);
            SET p_conversation_id = LAST_INSERT_ID();
        ELSE
            SET p_conversation_id = v_existing_conversation_id;
        END IF;
    END IF;
    
    COMMIT;
END;

-- Procedure para buscar projetos para matching
CREATE PROCEDURE sp_get_projects_for_matching(
    IN p_collaborator_id INT
)
BEGIN
    SELECT DISTINCT p.*, u.email as idealizer_email, up.first_name, up.last_name,
           up.location as idealizer_location
    FROM projects p
    JOIN users u ON p.idealizer_id = u.id
    LEFT JOIN user_profiles up ON u.id = up.user_id
    LEFT JOIN swipe_history sh ON (sh.user_id = p_collaborator_id AND sh.target_id = p.id AND sh.target_type = 'project')
    WHERE p.status = 'active'
    AND p.idealizer_id != p_collaborator_id
    AND sh.id IS NULL
    ORDER BY p.created_at DESC;
END;

-- ==== TRIGGERS ====

-- Trigger para criar conversa automaticamente quando match é aceito
CREATE TRIGGER tr_match_accepted_create_conversation
    AFTER UPDATE ON matches
    FOR EACH ROW
BEGIN
    DECLARE v_conversation_exists INT DEFAULT 0;
    
    -- Se o status mudou para 'accepted' e ambos estão interessados
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' 
       AND NEW.collaborator_interested = TRUE AND NEW.idealizer_interested = TRUE THEN
        
        -- Verificar se já existe conversa
        SELECT COUNT(*) INTO v_conversation_exists
        FROM conversations WHERE match_id = NEW.id;
        
        -- Criar conversa se não existir
        IF v_conversation_exists = 0 THEN
            INSERT INTO conversations (match_id) VALUES (NEW.id);
        END IF;
    END IF;
END;

-- Trigger para marcar perfil como completo quando user_profiles é inserido
CREATE TRIGGER tr_profile_complete_insert
    AFTER INSERT ON user_profiles
    FOR EACH ROW
BEGIN
    UPDATE users SET is_profile_complete = TRUE WHERE id = NEW.user_id;
END;

-- Trigger para marcar perfil como completo quando user_profiles é atualizado
CREATE TRIGGER tr_profile_complete_update
    AFTER UPDATE ON user_profiles
    FOR EACH ROW
BEGIN
    UPDATE users SET is_profile_complete = TRUE WHERE id = NEW.user_id;
END;

-- Trigger para log de atividades de swipe (opcional - para auditoria)
CREATE TRIGGER tr_swipe_activity_log
    AFTER INSERT ON swipe_history
    FOR EACH ROW
BEGIN
    -- Aqui você poderia inserir em uma tabela de log se necessário
    -- Por enquanto, apenas um placeholder
    SET @last_swipe_user = NEW.user_id;
END;