const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const passport = require('passport');
const flash = require('express-flash');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const db = require('./config/database');
require('./config/passport');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Session store configuration for MySQL
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  clearExpired: true,
  checkExpirationInterval: 90000, // 15 minutes
  expiration: 8640000, // 24 hours
  createDatabaseTable: true, // Automatically create sessions table
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
});

// Test session store connection
sessionStore.onReady(() => {
  console.log('MySQLStore ready');
});

// Middleware
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ÚNICA configuração de Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });
  
  socket.on('send-message', (messageData) => {
    console.log('Retransmitting message via socket:', messageData);
    
    // APENAS retransmitir para outros usuários - NÃO salvar no banco
    socket.to(`conversation_${messageData.conversationId}`).emit('new-message', {
      senderId: messageData.senderId,
      message: messageData.message,
      conversationId: messageData.conversationId,
      created_at: messageData.created_at || new Date().toISOString(),
      senderName: messageData.senderName
    });
  });
  
  socket.on('typing', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('user-typing', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    secure: false,
    httpOnly: true
  }
  // Removendo o store temporariamente para usar MemoryStore
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Global middleware for user data
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.messages = req.flash();
  next();
});

// REMOVER ESTA LINHA - está duplicando a configuração do Socket.IO
// require('./config/socket')(io); // <-- REMOVER

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/projects', require('./routes/projects'));
app.use('/match', require('./routes/match'));
app.use('/chat', require('./routes/chat'));

// Error handling
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Page Not Found',
    error: 'The page you are looking for does not exist.'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Server Error',
    error: 'Something went wrong on our end.'
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});