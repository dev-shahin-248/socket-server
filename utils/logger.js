const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'socket-server' },
  transports: [
    // Write to all logs with level `info` and below to file
    new winston.transports.File({ 
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Write all logs error (and below) to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  ]
});

// If we're not in production, log to console as well
if (config.server.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Security-focused logging methods
logger.security = {
  authAttempt: (socketId, success, reason = null) => {
    logger.info('Authentication attempt', {
      socketId,
      success,
      reason,
      timestamp: new Date().toISOString(),
      event: 'auth_attempt'
    });
  },
  
  roomAccess: (socketId, userId, roomId, action, success) => {
    logger.info('Room access', {
      socketId,
      userId,
      roomId,
      action,
      success,
      timestamp: new Date().toISOString(),
      event: 'room_access'
    });
  },
  
  messageEvent: (socketId, userId, roomId, messageLength, success = true) => {
    logger.info('Message event', {
      socketId,
      userId,
      roomId,
      messageLength,
      success,
      timestamp: new Date().toISOString(),
      event: 'message'
    });
  },
  
  rateLimitHit: (socketId, ip, event) => {
    logger.warn('Rate limit exceeded', {
      socketId,
      ip,
      event,
      timestamp: new Date().toISOString(),
      event: 'rate_limit'
    });
  },
  
  suspiciousActivity: (socketId, ip, activity, details) => {
    logger.warn('Suspicious activity detected', {
      socketId,
      ip,
      activity,
      details,
      timestamp: new Date().toISOString(),
      event: 'suspicious_activity'
    });
  }
};

module.exports = logger;
