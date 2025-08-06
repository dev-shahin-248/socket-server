const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: config.api.laravelUrl,
      timeout: config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': config.security.apiSecretKey,
        ...(config.api.laravelToken && {
          'Authorization': `Bearer ${config.api.laravelToken}`
        })
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('API Request', {
          method: config.method,
          url: config.url,
          headers: this.sanitizeHeaders(config.headers)
        });
        return config;
      },
      (error) => {
        logger.error('API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  // Remove sensitive data from headers for logging
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = 'Bearer [REDACTED]';
    }
    if (sanitized['X-API-Key']) {
      sanitized['X-API-Key'] = '[REDACTED]';
    }
    return sanitized;
  }

  // Retry logic with exponential backoff
  async retryRequest(requestFn, attempts = config.api.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await requestFn();
      } catch (error) {
        const isLastAttempt = i === attempts - 1;
        
        // Don't retry on client errors (4xx)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw error;
        }
        
        if (isLastAttempt) {
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = Math.pow(2, i) * 1000;
        logger.warn(`API request failed, retrying in ${delay}ms`, {
          attempt: i + 1,
          totalAttempts: attempts,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Store message in Laravel API
  async storeMessage(messageData) {
    return this.retryRequest(async () => {
      const response = await this.client.post('/api/store-message', {
        chat_room_id: messageData.chat_room_id,
        sender_id: messageData.sender_id,
        message: messageData.message,
        message_type: messageData.message_type || 'text',
        timestamp: new Date().toISOString()
      });
      
      logger.info('Message stored successfully', {
        chatRoomId: messageData.chat_room_id,
        senderId: messageData.sender_id,
        messageLength: messageData.message.length
      });
      
      return response.data;
    });
  }

  // Verify user has access to room
  async verifyRoomAccess(userId, roomId) {
    return this.retryRequest(async () => {
      const response = await this.client.get(`/api/rooms/${roomId}/access`, {
        params: { user_id: userId }
      });
      
      return response.data.hasAccess === true;
    });
  }

  // Get user information
  async getUserInfo(userId) {
    return this.retryRequest(async () => {
      const response = await this.client.get(`/api/users/${userId}`);
      return response.data;
    });
  }

  // Check if user is banned or suspended
  async getUserStatus(userId) {
    return this.retryRequest(async () => {
      const response = await this.client.get(`/api/users/${userId}/status`);
      return response.data;
    });
  }

  // Get room information
  async getRoomInfo(roomId) {
    return this.retryRequest(async () => {
      const response = await this.client.get(`/api/rooms/${roomId}`);
      return response.data;
    });
  }

  // Log user activity
  async logActivity(userId, activity, details = {}) {
    try {
      await this.client.post('/api/user-activity', {
        user_id: userId,
        activity,
        details,
        timestamp: new Date().toISOString(),
        ip_address: details.ip_address,
        user_agent: details.user_agent
      });
    } catch (error) {
      // Don't throw on logging failures
      logger.warn('Failed to log user activity', {
        userId,
        activity,
        error: error.message
      });
    }
  }

  // Health check endpoint
  async healthCheck() {
    try {
      const response = await this.client.get('/api/health', { timeout: 5000 });
      return {
        status: 'healthy',
        latency: response.headers['x-response-time'] || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const apiService = new ApiService();

module.exports = apiService;
