const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Create pool using DB_URL if available, otherwise fall back to individual credentials
const poolConfig = process.env.DB_URL ? process.env.DB_URL : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  // Configurações de timeout para Railway
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

const pool = mysql.createPool(poolConfig);

// Function to initialize database schema
async function initializeDatabase() {
  if (process.env.MODE === 'Development') {
    try {
      console.log('🔄 Development mode detected - Initializing database schema...');
      console.log('⚠️  WARNING: This will DROP all existing tables and recreate them!');
      
      // Read schema.sql file
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      const schemaSQL = await fs.readFile(schemaPath, 'utf8');
      
      // Remove comments and normalize line endings
      const cleanSQL = schemaSQL
        .replace(/--.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\n+/g, ' ') // Replace multiple newlines with single space
        .trim();
      
      // Split SQL statements by semicolon and filter out empty ones
      const statements = cleanSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      const connection = await pool.getConnection();
      
      try {
        // Disable foreign key checks temporarily
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        console.log('🔓 Foreign key checks disabled');
        
        console.log(`📋 Executing ${statements.length} SQL statements...`);
        
        // Execute each statement individually
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement) {
            try {
              // Show first part of statement for identification
              const preview = statement.length > 80 
                ? statement.substring(0, 80) + '...' 
                : statement;
              console.log(`   ${i + 1}/${statements.length}: ${preview}`);
              
              await connection.execute(statement);
              console.log(`   ✅ Statement ${i + 1} executed successfully`);
              
            } catch (statementError) {
              console.error(`❌ Error in statement ${i + 1}:`, statementError.message);
              console.error(`   Statement: ${statement.substring(0, 200)}...`);
              // Continue with other statements instead of stopping
            }
          }
        }
        
        // Re-enable foreign key checks
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('🔒 Foreign key checks re-enabled');
        
        // Verify tables were created
        const [tables] = await connection.execute('SHOW TABLES');
        console.log(`📊 Tables created: ${tables.length}`);
        tables.forEach(table => {
          const tableName = Object.values(table)[0];
          console.log(`   - ${tableName}`);
        });
        
        console.log('✅ Database schema initialized successfully!');
        
      } finally {
        connection.release();
      }
      
    } catch (error) {
      console.error('❌ Error initializing database schema:', error);
      throw error;
    }
  } else {
    console.log('🏭 Production mode - Skipping schema initialization');
  }
}

// If using DB_URL, we still need to set the connection options
if (process.env.DB_URL) {
  // Parse the URL to extract connection details for logging
  const url = new URL(process.env.DB_URL);
  console.log(`🔗 Connecting to database: ${url.hostname}:${url.port}/${url.pathname.slice(1)}`);
} else {
  console.log(`🔗 Connecting to database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
}

// Test connection and initialize schema
pool.getConnection()
  .then(async (connection) => {
    console.log('✅ Connected to MySQL database');
    connection.release();
    
    // Initialize database schema in development mode
    await initializeDatabase();
  })
  .catch(err => {
    console.error('❌ Error connecting to database:', err);
  });

module.exports = {
  pool, // Exportar o pool para uso direto em transações
  initializeDatabase,
  query: async (text, params) => {
    try {
      console.log('Executing query:', text);
      console.log('With params:', params);
      
      const [result] = await pool.execute(text, params);
      
      // Check if this is a SELECT query (returns array) or INSERT/UPDATE/DELETE (returns object)
      if (text.trim().toUpperCase().startsWith('SELECT')) {
        console.log('SELECT query result rows:', result.length);
        return { rows: result };
      } else {
        console.log('Non-SELECT query result:', { insertId: result.insertId, affectedRows: result.affectedRows });
        return result; // Return the full result object which includes insertId
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};