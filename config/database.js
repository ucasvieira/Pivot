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
  // Configurações para produção
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = mysql.createPool(poolConfig);

// Function to configure MySQL session settings
async function configureMySQLSession() {
  try {
    const connection = await pool.getConnection();
    try {
      // Desabilitar ONLY_FULL_GROUP_BY para compatibilidade
      await connection.execute(`
        SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))
      `);
      console.log('✅ MySQL ONLY_FULL_GROUP_BY mode disabled for session');
      
      // Configurar outras opções se necessário
      await connection.execute('SET SESSION group_concat_max_len = 1000000');
      console.log('✅ MySQL session configured successfully');
      
    } finally {
      connection.release();
    }
  } catch (error) {
    console.warn('⚠️  Could not configure MySQL session:', error.message);
  }
}

// Function to initialize database schema (apenas em desenvolvimento)
async function initializeDatabase() {
  if (process.env.MODE === 'Development' && process.env.NODE_ENV !== 'production') {
    try {
      console.log('🔄 Development mode detected - Initializing database schema...');
      console.log('⚠️  WARNING: This will DROP all existing tables and recreate them!');
      
      // Read schema.sql file
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      const schemaSQL = await fs.readFile(schemaPath, 'utf8');
      
      // Clean SQL - remove comments but keep structure
      const cleanSQL = schemaSQL
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      
      console.log('📋 Executing complete SQL schema...');
      
      // Create a raw connection with multipleStatements enabled
      const rawConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
      });
      
      try {
        // Configure MySQL mode for this connection too
        await rawConnection.execute(`
          SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))
        `);
        
        // Disable foreign key checks temporarily
        await rawConnection.execute('SET FOREIGN_KEY_CHECKS = 0');
        console.log('🔓 Foreign key checks disabled');
        
        // Execute the entire SQL file at once
        console.log('🚀 Executing complete schema...');
        await rawConnection.query(cleanSQL);
        console.log('✅ Schema executed successfully');
        
        // Re-enable foreign key checks
        await rawConnection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('🔒 Foreign key checks re-enabled');
        
        // Verify tables were created
        const [tables] = await rawConnection.execute('SHOW TABLES');
        console.log(`📊 Tables created: ${tables.length}`);
        tables.forEach(table => {
          const tableName = Object.values(table)[0];
          console.log(`   - ${tableName}`);
        });
        
        // Verify functions were created
        try {
          const [functions] = await rawConnection.execute(`
            SELECT ROUTINE_NAME 
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'FUNCTION'
          `);
          console.log(`🔧 Functions created: ${functions.length}`);
          functions.forEach(func => {
            console.log(`   - ${func.ROUTINE_NAME}`);
          });
        } catch (error) {
          console.log('⚠️  Could not verify functions');
        }
        
        // Verify procedures were created
        try {
          const [procedures] = await rawConnection.execute(`
            SELECT ROUTINE_NAME 
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE'
          `);
          console.log(`⚙️  Procedures created: ${procedures.length}`);
          procedures.forEach(proc => {
            console.log(`   - ${proc.ROUTINE_NAME}`);
          });
        } catch (error) {
          console.log('⚠️  Could not verify procedures');
        }
        
        // Verify triggers were created
        try {
          const [triggers] = await rawConnection.execute(`
            SELECT TRIGGER_NAME 
            FROM INFORMATION_SCHEMA.TRIGGERS 
            WHERE TRIGGER_SCHEMA = DATABASE()
          `);
          console.log(`🎯 Triggers created: ${triggers.length}`);
          triggers.forEach(trigger => {
            console.log(`   - ${trigger.TRIGGER_NAME}`);
          });
        } catch (error) {
          console.log('⚠️  Could not verify triggers');
        }
        
        // Verify views were created
        try {
          const [views] = await rawConnection.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.VIEWS 
            WHERE TABLE_SCHEMA = DATABASE()
          `);
          console.log(`👁️  Views created: ${views.length}`);
          views.forEach(view => {
            console.log(`   - ${view.TABLE_NAME}`);
          });
        } catch (error) {
          console.log('⚠️  Could not verify views');
        }
        
        console.log('✅ Database schema initialized successfully!');
        
      } catch (error) {
        console.error('❌ Error executing schema:', error);
        
        // If there's an error, let's try to see which part failed
        if (error.message.includes('near') || error.message.includes('syntax')) {
          console.error('💡 SQL syntax error detected. This might be due to:');
          console.error('   - Missing semicolons');
          console.error('   - Incomplete stored procedures/functions');
          console.error('   - Invalid MySQL syntax');
          
          // Let's try to identify the problematic area
          const errorMatch = error.message.match(/at line (\d+)/);
          if (errorMatch) {
            const lineNumber = parseInt(errorMatch[1]);
            const lines = cleanSQL.split('\n');
            console.error(`   - Error around line ${lineNumber}:`);
            console.error(`     ${lines[lineNumber - 2] || ''}`);
            console.error(`   > ${lines[lineNumber - 1] || ''}`);
            console.error(`     ${lines[lineNumber] || ''}`);
          }
        }
        
        throw error;
      } finally {
        await rawConnection.end();
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
  const url = new URL(process.env.DB_URL);
  console.log(`🔗 Connecting to database: ${url.hostname}:${url.port}/${url.pathname.slice(1)}`);
} else {
  console.log(`🔗 Connecting to database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
}

// Test connection and initialize schema (apenas se não for produção)
if (process.env.NODE_ENV !== 'production') {
  pool.getConnection()
    .then(async (connection) => {
      console.log('✅ Connected to MySQL database');
      connection.release();
      
      // Configure MySQL session
      await configureMySQLSession();
      
      // Initialize database schema in development mode
      await initializeDatabase();
    })
    .catch(err => {
      console.error('❌ Error connecting to database:', err);
    });
}

module.exports = {
  pool,
  initializeDatabase,
  configureMySQLSession,
  query: async (text, params) => {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Executing query:', text);
        console.log('With params:', params);
      }
      
      // Get connection and configure it
      const connection = await pool.getConnection();
      
      try {
        // Configure session for this connection
        await connection.execute(`
          SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))
        `);
        
        const [result] = await connection.execute(text, params);
        
        if (text.trim().toUpperCase().startsWith('SELECT')) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('SELECT query result rows:', result.length);
          }
          return { rows: result };
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Non-SELECT query result:', { insertId: result.insertId, affectedRows: result.affectedRows });
          }
          return result;
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }
};