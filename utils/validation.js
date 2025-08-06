const Joi = require('joi');
const config = require('../config');

const schemas = {
  // JWT token validation
  authToken: Joi.object({
    token: Joi.string().required().min(10).max(500),
  }),

  // Join room validation
  joinRoom: Joi.object({
    chatRoomId: Joi.string()
      .required()
      .min(1)
      .max(config.validation.maxRoomIdLength)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .messages({
        'string.pattern.base': 'Chat room ID can only contain alphanumeric characters, underscores, and hyphens'
      }),
    token: Joi.string().optional()
  }),

  // Send message validation
  sendMessage: Joi.object({
    chat_room_id: Joi.string()
      .required()
      .min(1)
      .max(config.validation.maxRoomIdLength)
      .pattern(/^[a-zA-Z0-9_-]+$/),
    sender_id: Joi.string()
      .required()
      .min(1)
      .max(50)
      .pattern(/^[a-zA-Z0-9_-]+$/),
    message: Joi.string()
      .required()
      .min(1)
      .max(config.validation.maxMessageLength)
      .trim(),
    message_type: Joi.string()
      .optional()
      .valid('text', 'image', 'file', 'emoji')
      .default('text')
  }),

  // User validation
  user: Joi.object({
    id: Joi.string().required().min(1).max(50),
    username: Joi.string().optional().min(2).max(50),
    email: Joi.string().email().optional()
  })
};

// Validation middleware
const validate = (schema, data) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    return { isValid: false, errors: details };
  }

  return { isValid: true, data: value };
};

// Sanitize HTML content to prevent XSS
const sanitizeMessage = (message) => {
  if (typeof message !== 'string') return '';
  
  return message
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

// Check for suspicious patterns
const detectSuspiciousContent = (message) => {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:text\/html/i,
    /vbscript:/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(message));
};

module.exports = {
  schemas,
  validate,
  sanitizeMessage,
  detectSuspiciousContent
};
