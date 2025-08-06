const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

// JWT Authentication middleware for socket connections
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (!token) {
      logger.security.authAttempt(socket.id, false, 'No token provided');
      return next(new Error('Authentication required'));
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace('Bearer ', '');
    
    const decoded = jwt.verify(cleanToken, config.security.jwtSecret);
    
    // Attach user info to socket
    socket.userId = decoded.userId || decoded.id;
    socket.userRole = decoded.role || 'user';
    socket.userEmail = decoded.email;
    
    logger.security.authAttempt(socket.id, true, `User ${socket.userId} authenticated`);
    next();
    
  } catch (error) {
    logger.security.authAttempt(socket.id, false, `Invalid token: ${error.message}`);
    next(new Error('Invalid authentication token'));
  }
};

// Verify user has access to specific room
const verifyRoomAccess = async (socket, roomId) => {
  try {
    // This would typically check against your Laravel API
    // For now, we'll implement basic validation
    
    if (!socket.userId) {
      logger.security.roomAccess(socket.id, null, roomId, 'access_check', false);
      return false;
    }

    // TODO: Implement actual room access verification with Laravel API
    // const hasAccess = await checkRoomAccess(socket.userId, roomId);
    
    logger.security.roomAccess(socket.id, socket.userId, roomId, 'access_check', true);
    return true;
    
  } catch (error) {
    logger.error('Error verifying room access', {
      socketId: socket.id,
      userId: socket.userId,
      roomId,
      error: error.message
    });
    return false;
  }
};

// Role-based authorization
const requireRole = (requiredRole) => {
  return (socket, next) => {
    if (!socket.userRole) {
      return next(new Error('User role not found'));
    }

    const roleHierarchy = {
      'admin': 3,
      'moderator': 2,
      'user': 1
    };

    const userLevel = roleHierarchy[socket.userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 1;

    if (userLevel < requiredLevel) {
      logger.security.authAttempt(
        socket.id, 
        false, 
        `Insufficient privileges: ${socket.userRole} < ${requiredRole}`
      );
      return next(new Error('Insufficient privileges'));
    }

    next();
  };
};

// Check if user is banned or suspended
const checkUserStatus = async (socket, next) => {
  try {
    // TODO: Implement user status check with Laravel API
    // const userStatus = await getUserStatus(socket.userId);
    
    // if (userStatus.banned || userStatus.suspended) {
    //   logger.security.authAttempt(
    //     socket.id, 
    //     false, 
    //     `User ${socket.userId} is ${userStatus.banned ? 'banned' : 'suspended'}`
    //   );
    //   return next(new Error('Account suspended or banned'));
    // }

    next();
  } catch (error) {
    logger.error('Error checking user status', {
      socketId: socket.id,
      userId: socket.userId,
      error: error.message
    });
    next(new Error('Unable to verify user status'));
  }
};

module.exports = {
  authenticateSocket,
  verifyRoomAccess,
  requireRole,
  checkUserStatus
};
