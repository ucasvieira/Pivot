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
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.APP_URL, process.env.FRONTEND_URL].filter(Boolean)
      : "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Parse DB_URL para configuração do session store
let sessionStoreConfig;
if (process.env.DB_URL) {
  const url = new URL(process.env.DB_URL);
  sessionStoreConfig = {
    host: url.hostname,
    port: parseInt(url.port),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    clearExpired: true,
    checkExpirationInterval: 90000,
    expiration: 8640000,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  };
} else {
  sessionStoreConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    clearExpired: true,
    checkExpirationInterval: 90000,
    expiration: 8640000,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  };
}

const sessionStore = new MySQLStore(sessionStoreConfig);

// Test session store connection
sessionStore.onReady(() => {
  console.log('✅ MySQLStore ready');
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

// Socket.IO configuration
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });
  
  socket.on('send-message', (messageData) => {
    console.log('Retransmitting message via socket:', messageData);
    
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
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
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

// Railway precisa do server.listen
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌍 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Railway deployment ready`);
});

// Não exportar app para Railway (diferente da Vercel)
// module.exports = app;