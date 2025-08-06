const http = require('http');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

// Import our modules
const config = require('./config');
const logger = require('./utils/logger');
const { validate, schemas, sanitizeMessage, detectSuspiciousContent } = require('./utils/validation');
const { authenticateSocket, verifyRoomAccess, checkUserStatus } = require('./middleware/auth');
const { RateLimiter, rateLimitMiddleware, wrapWithMessageRateLimit } = require('./middleware/rateLimiter');
const apiService = require('./services/apiService');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting for HTTP endpoints
const httpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(httpLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Create HTTP server
const server = http.createServer(app);

// Initialize rate limiter for socket connections
const rateLimiter = new RateLimiter();

// Configure Socket.IO with security settings
const io = new Server(server, {
  cors: {
    origin: config.security.allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6, // 1MB
  transports: ['websocket', 'polling']
});

// Socket.IO middleware stack
io.use(rateLimitMiddleware(rateLimiter));
io.use(authenticateSocket);
io.use(checkUserStatus);

// Health check endpoint
app.get(config.healthCheck.path, async (req, res) => {
  try {
    const apiHealth = await apiService.healthCheck();
    const rateLimiterStats = rateLimiter.getStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      api: apiHealth,
      rateLimiter: rateLimiterStats,
      environment: config.server.nodeEnv
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Internal server error'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Socket.IO server is running',
    version: '2.0.0',
    environment: config.server.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Socket connection handling
io.on('connection', (socket) => {
  const clientIP = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'];
  
  logger.info('Client connected', {
    socketId: socket.id,
    userId: socket.userId,
    ip: clientIP,
    userAgent: userAgent
  });

  // Log user activity
  apiService.logActivity(socket.userId, 'socket_connect', {
    ip_address: clientIP,
    user_agent: userAgent
  });

  // Handle room joining with security checks
  socket.on('join-room', async (data) => {
    try {
      // Validate input
      const validation = validate(schemas.joinRoom, data);
      if (!validation.isValid) {
        logger.security.suspiciousActivity(
          socket.id,
          clientIP,
          'invalid_join_room_data',
          { errors: validation.errors }
        );
        socket.emit('error', { message: 'Invalid room data', errors: validation.errors });
        return;
      }

      const { chatRoomId } = validation.data;
      const roomName = `chat_room_${chatRoomId}`;

      // Verify user has access to this room
      const hasAccess = await verifyRoomAccess(socket, chatRoomId);
      if (!hasAccess) {
        logger.security.roomAccess(socket.id, socket.userId, chatRoomId, 'join_denied', false);
        socket.emit('error', { message: 'Access denied to this room' });
        return;
      }

      // Additional check with Laravel API
      try {
        const apiAccess = await apiService.verifyRoomAccess(socket.userId, chatRoomId);
        if (!apiAccess) {
          logger.security.roomAccess(socket.id, socket.userId, chatRoomId, 'api_access_denied', false);
          socket.emit('error', { message: 'Room access not authorized' });
          return;
        }
      } catch (error) {
        logger.error('Room access verification failed', {
          socketId: socket.id,
          userId: socket.userId,
          roomId: chatRoomId,
          error: error.message
        });
        socket.emit('error', { message: 'Unable to verify room access' });
        return;
      }

      // Join the room
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.currentRoomId = chatRoomId;

      logger.security.roomAccess(socket.id, socket.userId, chatRoomId, 'joined', true);
      socket.emit('room-joined', { roomId: chatRoomId, roomName });
      
      // Log activity
      apiService.logActivity(socket.userId, 'room_join', {
        room_id: chatRoomId,
        ip_address: clientIP
      });

    } catch (error) {
      logger.error('Join room error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle message sending with comprehensive security
  const handleSendMessage = wrapWithMessageRateLimit(rateLimiter, async (socket, data) => {
    try {
      // Validate message data
      const validation = validate(schemas.sendMessage, data);
      if (!validation.isValid) {
        logger.security.suspiciousActivity(
          socket.id,
          clientIP,
          'invalid_message_data',
          { errors: validation.errors }
        );
        socket.emit('message-error', { message: 'Invalid message data', errors: validation.errors });
        return;
      }

      const messageData = validation.data;
      
      // Verify sender matches authenticated user
      if (messageData.sender_id !== socket.userId) {
        logger.security.suspiciousActivity(
          socket.id,
          clientIP,
          'sender_mismatch',
          { claimed: messageData.sender_id, actual: socket.userId }
        );
        socket.emit('message-error', { message: 'Sender verification failed' });
        return;
      }

      // Check if user is still in the room
      const roomName = `chat_room_${messageData.chat_room_id}`;
      if (socket.currentRoomId !== messageData.chat_room_id) {
        logger.security.suspiciousActivity(
          socket.id,
          clientIP,
          'room_mismatch',
          { messageRoom: messageData.chat_room_id, socketRoom: socket.currentRoomId }
        );
        socket.emit('message-error', { message: 'Room verification failed' });
        return;
      }

      // Sanitize message content
      messageData.message = sanitizeMessage(messageData.message);
      
      // Detect suspicious content
      if (detectSuspiciousContent(messageData.message)) {
        logger.security.suspiciousActivity(
          socket.id,
          clientIP,
          'suspicious_message_content',
          { messageLength: messageData.message.length }
        );
        socket.emit('message-error', { message: 'Message contains suspicious content' });
        return;
      }

      // Add timestamp and additional metadata
      const enrichedMessage = {
        ...messageData,
        timestamp: new Date().toISOString(),
        socket_id: socket.id,
        ip_address: clientIP
      };

      // Broadcast to room first (for better UX)
      io.to(roomName).emit('receive-message', {
        chat_room_id: messageData.chat_room_id,
        sender_id: messageData.sender_id,
        message: messageData.message,
        message_type: messageData.message_type,
        timestamp: enrichedMessage.timestamp
      });

      // Store message in Laravel API
      try {
        await apiService.storeMessage(enrichedMessage);
        logger.security.messageEvent(
          socket.id,
          socket.userId,
          messageData.chat_room_id,
          messageData.message.length,
          true
        );
      } catch (error) {
        logger.error('Failed to store message', {
          socketId: socket.id,
          userId: socket.userId,
          roomId: messageData.chat_room_id,
          error: error.message
        });
        
        // Optionally notify sender about storage failure
        socket.emit('message-warning', { 
          message: 'Message sent but storage failed' 
        });
      }

      // Log activity
      apiService.logActivity(socket.userId, 'message_send', {
        room_id: messageData.chat_room_id,
        message_length: messageData.message.length,
        message_type: messageData.message_type,
        ip_address: clientIP
      });

    } catch (error) {
      logger.error('Send message error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      socket.emit('message-error', { message: 'Failed to send message' });
    }
  });

  socket.on('send-message', handleSendMessage);

  // Handle typing indicators with rate limiting
  const handleTyping = wrapWithMessageRateLimit(rateLimiter, async (socket, data) => {
    if (socket.currentRoom && data.chat_room_id === socket.currentRoomId) {
      socket.to(socket.currentRoom).emit('user-typing', {
        user_id: socket.userId,
        chat_room_id: data.chat_room_id,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('typing', handleTyping);

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    logger.info('Client disconnected', {
      socketId: socket.id,
      userId: socket.userId,
      reason,
      ip: clientIP
    });

    // Log activity
    apiService.logActivity(socket.userId, 'socket_disconnect', {
      reason,
      ip_address: clientIP
    });
  });

  // Handle connection errors
  socket.on('error', (error) => {
    logger.error('Socket error', {
      socketId: socket.id,
      userId: socket.userId,
      error: error.message,
      ip: clientIP
    });
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start the server
server.listen(config.server.port, config.server.host, () => {
  logger.info(`Socket.IO server running on ${config.server.host}:${config.server.port}`, {
    environment: config.server.nodeEnv,
    allowedOrigins: config.security.allowedOrigins,
    rateLimiting: config.rateLimiting
  });
});
