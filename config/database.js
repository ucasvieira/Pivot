const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to database:', err);
  });

module.exports = {
  pool,
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