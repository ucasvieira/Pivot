
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

-- Swipe history table
CREATE TABLE swipe_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    target_id INT NOT NULL,
    target_type ENUM('project', 'user') NOT NULL,
    action ENUM('like', 'pass') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_swipe (user_id, target_id, target_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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