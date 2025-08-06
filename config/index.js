require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'fallback-dev-secret',
    apiSecretKey: process.env.API_SECRET_KEY || 'fallback-api-secret',
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'],
  },
  
  api: {
    laravelUrl: process.env.LARAVEL_API_URL || 'http://host.docker.internal:8000',
    laravelToken: process.env.LARAVEL_API_TOKEN || '',
    timeout: parseInt(process.env.API_TIMEOUT) || 10000,
    retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS) || 3
  },
  
  rateLimiting: {
    maxConnectionsPerIp: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 50,
    messageRateWindow: parseInt(process.env.MESSAGE_RATE_LIMIT_WINDOW) || 60000,
    messageRateMax: parseInt(process.env.MESSAGE_RATE_LIMIT_MAX) || 100
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/socket-server.log'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    enabled: process.env.REDIS_ENABLED === 'true'
  },
  
  validation: {
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 1000,
    maxRoomIdLength: parseInt(process.env.MAX_ROOM_ID_LENGTH) || 50
  },
  
  healthCheck: {
    path: process.env.HEALTH_CHECK_PATH || '/health'
  }
};

// Validate required environment variables in production
if (config.server.nodeEnv === 'production') {
  const required = ['JWT_SECRET', 'API_SECRET_KEY', 'LARAVEL_API_TOKEN'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = config;
