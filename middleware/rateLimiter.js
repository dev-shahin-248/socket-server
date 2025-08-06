const config = require('../config');
const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    this.connectionCounts = new Map(); // IP -> count
    this.messageCounts = new Map(); // socketId -> { count, resetTime }
    this.cleanupInterval = 60000; // 1 minute
    
    // Clean up expired entries periodically
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  // Check if IP has exceeded connection limit
  checkConnectionLimit(ip) {
    const currentCount = this.connectionCounts.get(ip) || 0;
    
    if (currentCount >= config.rateLimiting.maxConnectionsPerIp) {
      logger.security.rateLimitHit(null, ip, 'connection_limit');
      return false;
    }
    
    this.connectionCounts.set(ip, currentCount + 1);
    return true;
  }

  // Remove connection from count when socket disconnects
  removeConnection(ip) {
    const currentCount = this.connectionCounts.get(ip) || 0;
    if (currentCount <= 1) {
      this.connectionCounts.delete(ip);
    } else {
      this.connectionCounts.set(ip, currentCount - 1);
    }
  }

  // Check if socket has exceeded message rate limit
  checkMessageLimit(socketId, userId = null) {
    const now = Date.now();
    const key = `${socketId}_${userId || 'anonymous'}`;
    let messageData = this.messageCounts.get(key);
    
    // Initialize or reset if window has passed
    if (!messageData || now >= messageData.resetTime) {
      messageData = {
        count: 1,
        resetTime: now + config.rateLimiting.messageRateWindow
      };
      this.messageCounts.set(key, messageData);
      return true;
    }
    
    // Check if limit exceeded
    if (messageData.count >= config.rateLimiting.messageRateMax) {
      const socket = this.getSocketFromId(socketId);
      const ip = socket?.handshake?.address || 'unknown';
      logger.security.rateLimitHit(socketId, ip, 'message_limit');
      return false;
    }
    
    messageData.count++;
    return true;
  }

  // Get socket instance by ID (you'll need to pass the io instance)
  getSocketFromId(socketId) {
    // This is a placeholder - you'll need to implement this based on your socket.io setup
    // return this.io?.sockets.sockets.get(socketId);
    return null;
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    
    // Clean up message counts
    for (const [key, data] of this.messageCounts.entries()) {
      if (now >= data.resetTime) {
        this.messageCounts.delete(key);
      }
    }
    
    logger.debug('Rate limiter cleanup completed', {
      connectionCounts: this.connectionCounts.size,
      messageCounts: this.messageCounts.size
    });
  }

  // Get current stats (for monitoring)
  getStats() {
    return {
      activeConnections: Array.from(this.connectionCounts.entries()).reduce((sum, [, count]) => sum + count, 0),
      uniqueIPs: this.connectionCounts.size,
      activeMessageLimits: this.messageCounts.size
    };
  }

  // Reset limits for a specific user (admin function)
  resetUserLimits(socketId, userId) {
    const key = `${socketId}_${userId || 'anonymous'}`;
    this.messageCounts.delete(key);
    logger.info('User rate limits reset', { socketId, userId });
  }
}

// Middleware function for Socket.IO
const rateLimitMiddleware = (rateLimiter) => {
  return (socket, next) => {
    const ip = socket.handshake.address;
    
    if (!rateLimiter.checkConnectionLimit(ip)) {
      return next(new Error('Too many connections from this IP'));
    }
    
    // Clean up on disconnect
    socket.on('disconnect', () => {
      rateLimiter.removeConnection(ip);
    });
    
    next();
  };
};

// Message rate limiting wrapper
const wrapWithMessageRateLimit = (rateLimiter, handler) => {
  return async (socket, data, callback) => {
    if (!rateLimiter.checkMessageLimit(socket.id, socket.userId)) {
      logger.security.rateLimitHit(
        socket.id, 
        socket.handshake.address, 
        'message_rate_limit'
      );
      
      if (callback) {
        callback({ error: 'Rate limit exceeded. Please slow down.' });
      }
      return;
    }
    
    try {
      await handler(socket, data, callback);
    } catch (error) {
      logger.error('Handler error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
      
      if (callback) {
        callback({ error: 'Internal server error' });
      }
    }
  };
};

module.exports = {
  RateLimiter,
  rateLimitMiddleware,
  wrapWithMessageRateLimit
};
